-- Billing / Subscription schema for lecture-note-app (MySQL 8+)

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255) NULL,
  ADD UNIQUE KEY IF NOT EXISTS uk_users_stripe_customer_id (stripe_customer_id);

CREATE TABLE IF NOT EXISTS plans (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  plan_code VARCHAR(50) NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  stripe_price_id VARCHAR(255) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_plans_plan_code (plan_code),
  UNIQUE KEY uk_plans_stripe_price_id (stripe_price_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS subscriptions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  stripe_customer_id VARCHAR(255) NOT NULL,
  stripe_subscription_id VARCHAR(255) NOT NULL,
  plan_code VARCHAR(50) NOT NULL DEFAULT 'free',
  subscription_status VARCHAR(50) NOT NULL DEFAULT 'incomplete',
  current_period_end DATETIME NULL,
  cancel_at_period_end TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_subscriptions_user_id (user_id),
  UNIQUE KEY uk_subscriptions_stripe_subscription_id (stripe_subscription_id),
  KEY idx_subscriptions_customer_id (stripe_customer_id),
  KEY idx_subscriptions_status (subscription_status),
  CONSTRAINT fk_subscriptions_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS payment_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  event_id VARCHAR(255) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  payload JSON NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_payment_events_event_id (event_id),
  KEY idx_payment_events_event_type (event_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS usage_counters (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  feature_code VARCHAR(100) NOT NULL,
  period_month CHAR(7) NOT NULL COMMENT 'YYYY-MM (UTC)',
  used_count INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_usage_user_feature_period (user_id, feature_code, period_month),
  KEY idx_usage_feature_period (feature_code, period_month),
  CONSTRAINT fk_usage_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO plans (plan_code, display_name, stripe_price_id)
VALUES
  ('free', 'Free Plan', NULL),
  ('pro', 'Pro Monthly', 'replace_with_real_price_id')
ON DUPLICATE KEY UPDATE
  display_name = VALUES(display_name),
  stripe_price_id = VALUES(stripe_price_id),
  is_active = 1;
