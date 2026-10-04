export function earnedStars(level, state) {
  const efficient = state.shots <= level.idealShots;
  return 1 + Number(efficient) + Number(efficient && state.time <= level.threeStarTime);
}
