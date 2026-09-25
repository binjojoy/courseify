import React from 'react';
import { Course } from '../types';
import { storage } from '../services/storage';

interface ContinueLearningBannerProps {
  course: Course;
  onResume: (courseId: string, videoId?: string) => void;
}

export const ContinueLearningBanner: React.FC<ContinueLearningBannerProps> = ({
  course,
  onResume
}) => {
  const metrics = storage.getCourseMetrics(course.id);
  const videos = storage.getCourseVideos(course.id);
  const progress = storage.getCourseProgress(course.id);

  const currentVideoId = metrics.lastVideoId || videos[0]?.videoId;
  const currentVideo = videos.find(v => v.videoId === currentVideoId) || videos[0];
  const videoProgress = progress.videos[currentVideoId];
  const positionSec = videoProgress?.positionSec || 0;
  const videoDurationSec = currentVideo?.durationSec || 600;

  // Format position vs total: e.g. 14:28 / 26:10
  const formatSec = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const formatDuration = (sec: number) => {
    const hours = Math.floor(sec / 3600);
    const minutes = Math.floor((sec % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  const videoFraction = Math.min(100, Math.round((positionSec / Math.max(1, videoDurationSec)) * 100));

  return (
    <section className="mt-8 bg-bg-surface rounded-xl p-4 shadow-sm transition-all hover:shadow-md border border-border-default">
      <div className="flex flex-col md:flex-row items-stretch gap-5">
        {/* Thumbnail Preview Frame */}
        <div className="relative w-full md:w-[280px] shrink-0 aspect-[16/9] rounded-lg overflow-hidden bg-surface-container group">
          <img
            alt={currentVideo?.title || course.title}
            src={currentVideo?.thumbnailUrl || course.thumbnailUrl}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-player-black/70 via-player-black/20 to-transparent flex items-end p-2.5">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-black/75 text-white font-caption text-caption backdrop-blur-sm">
              <span className="material-symbols-outlined text-[14px]">timer</span>
              {formatSec(positionSec)} / {formatSec(videoDurationSec)}
            </span>
          </div>

          {/* Integrated progress indicator track */}
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
            <div
              className="h-full bg-accent transition-all duration-300"
              style={{ width: `${videoFraction}%` }}
            ></div>
          </div>
        </div>

        {/* Banner Content Stack */}
        <div className="flex-1 flex flex-col justify-between py-0.5">
          <div className="flex flex-col">
            <div className="flex items-center justify-between gap-space-sm mb-1">
              <span className="font-caption text-caption text-text-muted flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">schedule</span>
                Last watched recently
              </span>
              <span className="px-2 py-0.5 rounded-full bg-accent-subtle text-accent font-caption-medium text-caption-medium">
                In progress
              </span>
            </div>
            <h2 className="font-heading text-heading text-text-primary tracking-tight">
              {course.title}
            </h2>
            <p className="font-body text-body text-text-secondary mt-0.5 line-clamp-1">
              {currentVideo?.position !== undefined ? `${currentVideo.position + 1}. ` : ''}{currentVideo?.title}
            </p>
          </div>

          <div className="mt-4 flex flex-col gap-3">
            <div className="flex items-center justify-between text-caption font-caption text-text-secondary">
              <span className="font-body-sm-medium text-body-sm-medium text-text-primary">
                {metrics.completedVideos} of {metrics.totalVideos} videos
              </span>
              <span className="font-caption-medium text-caption-medium text-accent">
                {metrics.completionPercent}% completed
              </span>
            </div>

            <div className="w-full h-1.5 bg-surface-container rounded-full overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-all duration-500"
                style={{ width: `${metrics.completionPercent}%` }}
              ></div>
            </div>

            <div className="pt-1 flex items-center justify-between">
              <span className="font-caption text-caption text-text-muted">
                Total course duration: {formatDuration(metrics.totalDurationSec)}
              </span>
              <button
                type="button"
                onClick={() => onResume(course.id, currentVideoId)}
                className="inline-flex items-center gap-2 h-11 px-5 rounded-lg bg-accent text-white font-body-sm-medium text-body-sm-medium hover:bg-accent-hover active:bg-accent-pressed transition-colors shadow-sm focus:outline-none"
              >
                <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  play_arrow
                </span>
                <span>Resume</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
