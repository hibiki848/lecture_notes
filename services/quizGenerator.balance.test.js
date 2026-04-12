const assert = require('assert');
const {
  buildBalancedAnswerIndices,
  rebalanceQuizAnswerPositions,
  summarizeAnswerPositionDistribution,
} = require('./quizGenerator');

function createSeededRandom(seed) {
  let x = seed >>> 0;
  return () => {
    x = (1664525 * x + 1013904223) >>> 0;
    return x / 0x100000000;
  };
}

function makeQuizzes(count) {
  return Array.from({ length: count }, (_, i) => ({
    question: `Q${i + 1}`,
    quiz_type: "multiple_choice",
    correct_answer: `correct-${i + 1}`,
    choice_1: `correct-${i + 1}`,
    choice_2: `wrong-a-${i + 1}`,
    choice_3: `wrong-b-${i + 1}`,
    choice_4: `wrong-c-${i + 1}`,
  }));
}

(function testBalancedIndicesCount10() {
  const indices = buildBalancedAnswerIndices(10, createSeededRandom(1));
  const counts = [0, 0, 0, 0];
  indices.forEach((idx) => counts[idx]++);
  assert.deepStrictEqual(counts, [3, 3, 2, 2]);
})();

(function testBalancedIndicesCount20() {
  const indices = buildBalancedAnswerIndices(20, createSeededRandom(2));
  const counts = [0, 0, 0, 0];
  indices.forEach((idx) => counts[idx]++);
  assert.deepStrictEqual(counts, [5, 5, 5, 5]);
})();

(function testRebalancePreservesCorrectAnswer() {
  const quizzes = makeQuizzes(10);
  const balanced = rebalanceQuizAnswerPositions(quizzes, createSeededRandom(3));

  balanced.forEach((quiz, i) => {
    const choices = [quiz.choice_1, quiz.choice_2, quiz.choice_3, quiz.choice_4];
    assert(choices.includes(`correct-${i + 1}`));
    assert.strictEqual(quiz.correct_answer, `correct-${i + 1}`);
  });

  const distribution = summarizeAnswerPositionDistribution(balanced);
  assert.deepStrictEqual(distribution, { '1': 3, '2': 3, '3': 2, '4': 2 });
})();

console.log('quizGenerator balance tests passed');
