import { ContourAnnotation } from './ContourAnnotation';

export type ContourSegmentationAnnotationData = {
  autoGenerated?: boolean;
  data: {
    segmentation: {
      segmentationId: string;
      segmentIndex: number;
      segmentationRepresentationUID: string;
    };
  };
};

export type ContourSegmentationAnnotation = ContourAnnotation &
  ContourSegmentationAnnotationData;
