import type { Chapter } from '../types';

export const CHAPTERS: Chapter[] = [
  {
    id: 'ch1',
    name: '廢城遺跡',
    stageIds: ['1-1', '1-2', '1-3', '1-4', '1-5'],
  },
  {
    id: 'ch2',
    name: '破敗工廠',
    stageIds: ['2-1', '2-2', '2-3', '2-4', '2-5'],
    unlockAfterChapterId: 'ch1',
  },
  {
    id: 'ch3',
    name: '輻射荒原',
    stageIds: ['3-1', '3-2', '3-3', '3-4', '3-5'],
    unlockAfterChapterId: 'ch2',
  },
  {
    id: 'ch4',
    name: '機械廢都',
    stageIds: ['4-1', '4-2', '4-3', '4-4', '4-5'],
    unlockAfterChapterId: 'ch3',
  },
  {
    id: 'ch5',
    name: '亡靈禁地',
    stageIds: ['5-1', '5-2', '5-3', '5-4', '5-5'],
    unlockAfterChapterId: 'ch4',
  },
];
