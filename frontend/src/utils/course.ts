import { Course, VideoItem } from '../types';

export const isPlayableVideo = (video: VideoItem): boolean => !video.unavailable;

export const getPlayableVideos = (videos: VideoItem[]): VideoItem[] => videos.filter(isPlayableVideo);

export const getCourseSourceKey = (course: Course): string => {
  if (course.source) return `${course.source.type}:${course.source.id}`;
  return course.id;
};