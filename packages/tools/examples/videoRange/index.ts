import {
  RenderingEngine,
  Types,
  Enums,
  eventTarget,
  triggerEvent,
} from '@cornerstonejs/core';
import {
  addButtonToToolbar,
  addDropdownToToolbar,
  initDemo,
  setTitleAndDescription,
  createImageIdsAndCacheMetaData,
  getLocalUrl,
} from '../../../../utils/demo/helpers';
import * as cornerstoneTools from '@cornerstonejs/tools';

// This is for debugging purposes
console.warn(
  'Click on index.ts to open source code for this example --------->'
);

const {
  KeyImageTool,
  VideoRedactionTool,

  PanTool,
  ZoomTool,
  StackScrollMouseWheelTool,
  StackScrollTool,
  ToolGroupManager,
  Enums: csToolsEnums,
} = cornerstoneTools;

const { annotationFrameRange } = cornerstoneTools.utilities;

const { ViewportType } = Enums;
const { MouseBindings, KeyboardBindings, Events: toolsEvents } = csToolsEnums;

const toolGroupId = 'VIDEO_TOOL_GROUP_ID';

// ======== Set up page ======== //
setTitleAndDescription(
  'Video Range and Key Images Examples',
  'Show a video viewport with controls to allow it to specify ranges and key images'
);

const content = document.getElementById('content');

// Create a selection info element
const selectionDiv = document.createElement('div');
selectionDiv.id = 'selection';
selectionDiv.style.width = '90%';
selectionDiv.style.height = '3em';
content.appendChild(selectionDiv);

// ************* Create the cornerstone element.
const element = document.createElement('div');
// Disable right click context menu so we can have right click tools
element.oncontextmenu = (e) => e.preventDefault();

element.id = 'cornerstone-element';
element.style.width = '500px';
element.style.height = '500px';

content.appendChild(element);

const rangeDiv = document.createElement('div');
rangeDiv.innerHTML =
  '<div id="time" style="float:left;width:2.5em;">0 s</div><input id="range" style="width:400px;height:8px;float: left" value="0" type="range" /><div id="remaining">unknown</div>';
content.appendChild(rangeDiv);
const rangeElement = document.getElementById('range') as HTMLInputElement;
rangeElement.onchange = () => {
  viewport.setTime(Number(rangeElement.value));
};
rangeElement.oninput = () => {
  viewport.setTime(Number(rangeElement.value));
};

const instructions = document.createElement('p');
instructions.innerText = `Play/Pause button will toggle the playing of video
Clear Frame Range clears and selected from range on playback
Click the viewer to apply a key image (range if playing, frame if still).
Annotation navigation will choose next/previous annotation in the group
Select start/current/end range to set the start of the range, the current image and the end range
`;

content.append(instructions);
// ============================= //

const renderingEngineId = 'myRenderingEngine';
const viewportId = 'videoViewportId';
const baseEventDetail = {
  viewportId,
  renderingEngineId,
};

let viewport;

const playButton = addButtonToToolbar({
  id: 'play',
  title: 'Pause',
  onClick: (evt) => togglePlay(),
});

addButtonToToolbar({
  id: 'Clear',
  title: 'Clear Frame Range',
  onClick() {
    viewport.setFrameRange(null);
    viewport.play();
  },
});

const toolsNames = [KeyImageTool.toolName, VideoRedactionTool.toolName];
let selectedToolName = toolsNames[0];

addDropdownToToolbar({
  options: { values: toolsNames, defaultValue: selectedToolName },
  onSelectedValueChange: (newSelectedToolNameAsStringOrNumber) => {
    const newSelectedToolName = String(newSelectedToolNameAsStringOrNumber);
    const toolGroup = ToolGroupManager.getToolGroup(toolGroupId);

    // Set the new tool active
    toolGroup.setToolActive(newSelectedToolName, {
      bindings: [
        {
          mouseButton: MouseBindings.Primary, // Left Click
        },
      ],
    });

    // Set the old tool passive
    toolGroup.setToolPassive(selectedToolName);

    selectedToolName = <string>newSelectedToolName;
  },
});

addButtonToToolbar({
  id: 'Previous',
  title: '< Previous Annotation',
  onClick() {
    selectNextAnnotation(-1);
  },
});

addButtonToToolbar({
  id: 'Next',
  title: 'Next Annotation >',
  onClick() {
    selectNextAnnotation(1);
  },
});

function togglePlay(toggle = undefined) {
  if (toggle === undefined) {
    toggle = viewport.togglePlayPause();
  } else if (toggle === true) {
    viewport.play();
  } else {
    viewport.pause();
  }
  playButton.innerText = toggle ? 'Play' : 'Pause';
}

addButtonToToolbar({
  id: 'Set Range [',
  title: 'Start Range',
  onClick() {
    const annotation = getActiveAnnotation();
    if (annotation) {
      const rangeSelection = annotationFrameRange.getFrameRange(annotation);
      const frame = viewport.getFrameNumber();
      const range = Array.isArray(rangeSelection)
        ? rangeSelection
        : [rangeSelection, viewport.numberOfFrames];
      range[0] = frame;
      range[1] = Math.max(frame, range[1]);
      annotationFrameRange.setFrameRange(
        annotation,
        range as [number, number],
        baseEventDetail
      );
      viewport.setFrameRange(range);
      viewport.render();
    }
  },
});

addButtonToToolbar({
  id: 'Set Current',
  title: 'Current Image',
  onClick() {
    const annotation = getActiveAnnotation();
    if (annotation) {
      togglePlay(false);
      annotationFrameRange.setFrameRange(
        annotation,
        viewport.getFrameNumber(),
        baseEventDetail
      );
      viewport.render();
    }
  },
});

addButtonToToolbar({
  id: 'End Range',
  title: 'End Range',
  onClick() {
    const annotation = getActiveAnnotation();
    if (annotation) {
      const rangeSelection = annotationFrameRange.getFrameRange(annotation);
      const frame = viewport.getFrameNumber();
      const range = Array.isArray(rangeSelection)
        ? rangeSelection
        : [rangeSelection, viewport.getNumberOfSlices()];
      range[1] = frame;
      range[0] = Math.min(frame, range[0]);
      annotationFrameRange.setFrameRange(
        annotation,
        range as [number, number],
        baseEventDetail
      );
      viewport.setFrameRange(range);
      viewport.render();
    }
  },
});

function annotationModifiedListener(evt) {
  updateAnnotationDiv(
    evt.detail.annotation?.annotationUID ||
      evt.detail.annotationUID ||
      evt.detail.added?.[0]
  );
}

const selectedAnnotation = {
  annotationUID: '',
};

const activeGroup = new cornerstoneTools.annotation.AnnotationGroup();

function updateAnnotationDiv(uid) {
  const annotation = cornerstoneTools.annotation.state.getAnnotation(uid);
  if (!annotation) {
    selectionDiv.innerHTML = '';
    selectedAnnotation.annotationUID = '';
    return;
  }
  selectedAnnotation.annotationUID = uid;
  const { metadata, data } = annotation;
  const { toolName } = metadata;
  const range = annotationFrameRange.getFrameRange(annotation);
  const rangeArr = Array.isArray(range) ? range : [range];
  const { fps } = viewport;
  selectionDiv.innerHTML = `
    <b>${toolName} Annotation UID:</b>${uid} <b>Label:</b>${
    data.label || data.text
  } ${annotation.isVisible ? 'visible' : 'not visible'}<br />
    <b>Range:</b> Frames: ${rangeArr.join('-')} Times ${rangeArr
    .map((it) => Math.round((it * 10) / fps) / 10)
    .join('-')}<br />
  `;
}

function getActiveAnnotation() {
  return cornerstoneTools.annotation.state.getAnnotation(
    selectedAnnotation.annotationUID
  );
}

function addAnnotationListeners() {
  eventTarget.addEventListener(
    toolsEvents.ANNOTATION_SELECTION_CHANGE,
    annotationModifiedListener
  );
  eventTarget.addEventListener(
    toolsEvents.ANNOTATION_MODIFIED,
    annotationModifiedListener
  );
  eventTarget.addEventListener(
    toolsEvents.ANNOTATION_COMPLETED,
    annotationModifiedListener
  );
  eventTarget.addEventListener(toolsEvents.ANNOTATION_ADDED, (evt) => {
    const { detail } = evt;
    activeGroup.add(detail.annotation?.annotationUID || detail.annotationUID);
  });
}

function selectNextAnnotation(direction) {
  const uid = selectedAnnotation.annotationUID;
  const nextUid =
    activeGroup.findNearby(uid, direction) ||
    activeGroup.findNearby(null, direction);
  updateAnnotationDiv(nextUid);
  if (!nextUid) {
    return;
  }
  const annotation = cornerstoneTools.annotation.state.getAnnotation(nextUid);
  if (!annotation) {
    return;
  }
  const range = annotationFrameRange.getFrameRange(annotation);
  if (Array.isArray(range)) {
    viewport.setFrameRange(range);
    togglePlay(true);
    viewport.setFrameNumber(range[0]);
  } else {
    viewport.setFrameRange(null);
    togglePlay(false);
    viewport.setFrameNumber(range);
  }
}

/**
 * Runs the demo
 */
async function run() {
  // Init Cornerstone and related libraries
  await initDemo();

  // Get Cornerstone imageIds and fetch metadata into RAM
  const imageIds = await createImageIdsAndCacheMetaData({
    StudyInstanceUID: '2.25.96975534054447904995905761963464388233',
    SeriesInstanceUID: '2.25.15054212212536476297201250326674987992',
    wadoRsRoot:
      getLocalUrl() || 'https://d33do7qe4w26qo.cloudfront.net/dicomweb',
  });

  // Only one SOP instances is DICOM, so find it
  const videoId = imageIds.find(
    (it) => it.indexOf('2.25.179478223177027022014772769075050874231') !== -1
  );

  addAnnotationListeners();

  // Add annotation tools to Cornerstone3D
  cornerstoneTools.addTool(KeyImageTool);
  cornerstoneTools.addTool(VideoRedactionTool);
  cornerstoneTools.addTool(StackScrollMouseWheelTool);

  // Add tools to Cornerstone3D
  cornerstoneTools.addTool(PanTool);
  cornerstoneTools.addTool(ZoomTool);
  cornerstoneTools.addTool(StackScrollTool);

  // Define a tool group, which defines how mouse events map to tool commands for
  // Any viewport using the group
  const toolGroup = ToolGroupManager.createToolGroup(toolGroupId);

  // Add tools to the tool group
  toolGroup.addTool(KeyImageTool.toolName);
  toolGroup.addTool(PanTool.toolName);
  toolGroup.addTool(VideoRedactionTool.toolName);

  toolGroup.addTool(ZoomTool.toolName);
  toolGroup.addTool(StackScrollTool.toolName);

  toolGroup.setToolActive(VideoRedactionTool.toolName, {
    bindings: [
      {
        mouseButton: MouseBindings.Primary,
        modifierKey: KeyboardBindings.ShiftAlt,
      },
    ],
  });
  toolGroup.setToolActive(KeyImageTool.toolName, {
    bindings: [
      {
        mouseButton: MouseBindings.Primary, // Middle Click
      },
    ],
  });
  toolGroup.setToolActive(PanTool.toolName, {
    bindings: [
      {
        mouseButton: MouseBindings.Auxiliary, // Middle Click
      },
      {
        mouseButton: MouseBindings.Primary, // Ctrl Left drag
        modifierKey: KeyboardBindings.Ctrl,
      },
    ],
  });
  toolGroup.setToolActive(ZoomTool.toolName, {
    bindings: [
      {
        mouseButton: MouseBindings.Primary, // Shift Left Click
        modifierKey: KeyboardBindings.Shift,
      },
    ],
  });
  toolGroup.setToolActive(StackScrollTool.toolName, {
    bindings: [
      {
        mouseButton: MouseBindings.Secondary,
      },
      {
        mouseButton: MouseBindings.Primary,
        modifierKey: KeyboardBindings.Alt,
      },
    ],
  });

  // Get Cornerstone imageIds and fetch metadata into RAM

  // Instantiate a rendering engine
  const renderingEngine = new RenderingEngine(renderingEngineId);

  // Create a stack viewport

  const viewportInput = {
    viewportId,
    type: ViewportType.VIDEO,
    element,
    defaultOptions: {
      background: <Types.Point3>[0.2, 0, 0.2],
    },
  };

  renderingEngine.enableElement(viewportInput);

  // Get the stack viewport that was created
  viewport = <Types.IVideoViewport>renderingEngine.getViewport(viewportId);

  toolGroup.addViewport(viewport.id, renderingEngineId);

  // Set the video on the viewport
  // Will be `<dicomwebRoot>/studies/<studyUID>/series/<seriesUID>/instances/<instanceUID>/rendered?accept=video/mp4`
  // on a compliant DICOMweb endpoint
  await viewport.setVideo(videoId, 25);

  viewport.play();

  const seconds = (time) => `${Math.round(time * 10) / 10} s`;

  element.addEventListener(Enums.Events.IMAGE_RENDERED, (evt: any) => {
    const { time, duration } = evt.detail;
    rangeElement.value = time;
    rangeElement.max = duration;
    const timeElement = document.getElementById('time');
    timeElement.innerText = seconds(time);
    const remainingElement = document.getElementById('remaining');
    remainingElement.innerText = seconds(duration - time);
  });
}

run();
