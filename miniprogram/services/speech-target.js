const bundled = require('../data/local-courses');
// 旧缓存课程可能尚无 speech 字段。只为与当前内置目标完全相同的活动补充入口，
// 同时避免远程内容更新后仍拿旧文本评分。后端使用同一份课程源生成的清单。
function target(lesson, activity) {
  if (!lesson || lesson.category !== 'english' || !activity) return null;
  const local = bundled.lessons[lesson.id];
  if (!local || local.version !== lesson.version) return null;
  const expected = local.activities.find(item => item.id === activity.id);
  if (!expected || !expected.speech || expected.text !== activity.text || expected.audio !== activity.audio || expected.type !== activity.type) return null;
  if (activity.speech && activity.speech.mode !== expected.speech.mode) return null;
  return { lessonId: lesson.id, lessonVersion: lesson.version, activityId: activity.id };
}
module.exports = { target };
