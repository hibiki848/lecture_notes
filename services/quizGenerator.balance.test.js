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
    choices: [`correct-${i + 1}`, `wrong-a-${i + 1}`, `wrong-b-${i + 1}`, `wrong-c-${i + 1}`],
    answerIndex: 0,
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
    assert.strictEqual(quiz.choices[quiz.answerIndex], `correct-${i + 1}`);
  });

  const distribution = summarizeAnswerPositionDistribution(balanced);
  assert.deepStrictEqual(distribution, { '1': 3, '2': 3, '3': 2, '4': 2 });
})();

console.log('quizGenerator balance tests passed');
