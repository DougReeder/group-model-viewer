/* global AFRAME, THREE */

const INDICATOR_LENGTH = 0.33;
const INDICATOR_RADIUS = 0.02;
const TITLE_ID = 'title';

AFRAME.registerComponent('model-viewer', {
  schema: {
    uploadUIEnabled: {default: true}
  },
  init: function () {
    var el = this.el;

    el.setAttribute('renderer', {colorManagement: true});
    el.setAttribute('raycaster', {objects: '.raycastable'});
    el.setAttribute('cursor', {rayOrigin: 'mouse', fuse: false});
    el.setAttribute('webxr', {optionalFeatures: 'hit-test, local-floor, light-estimation, anchors'});
    el.setAttribute('background', '');

    this.onModelLoaded = this.onModelLoaded.bind(this);
    this.anchorQuaternion = new THREE.Quaternion();
    this.anchorRotation = new THREE.Euler();
    this.onArHitTestSelect = this.onArHitTestSelect.bind(this);

    this.onMouseUp = this.onMouseUp.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onMouseDown = this.onMouseDown.bind(this);
    this.onMouseWheel = this.onMouseWheel.bind(this);

    this.onTouchMove = this.onTouchMove.bind(this);
    this.onTouchEnd = this.onTouchEnd.bind(this);

    this.submitURLButtonClicked = this.submitURLButtonClicked.bind(this);

    this.onThumbstickMoved = this.onThumbstickMoved.bind(this);

    this.onEnterVR = this.onEnterVR.bind(this);
    this.onExitVR = this.onExitVR.bind(this);

    this.onMouseDownLaserHitPanel = this.onMouseDownLaserHitPanel.bind(this);
    this.onMouseUpLaserHitPanel = this.onMouseUpLaserHitPanel.bind(this);

    this.onOrientationChange = this.onOrientationChange.bind(this);

    this.initCameraRig();
    this.initEntities();
    this.initBackground();

    if (this.data.uploadUIEnabled) { this.initUploadInput(); }

    // Disable context menu on canvas when pressing mouse right button;
    this.el.sceneEl.canvas.oncontextmenu = function (evt) { evt.preventDefault(); };

    window.addEventListener('orientationchange', this.onOrientationChange);

    // VR controls.
    this.laserHitPanelEl.addEventListener('mousedown', this.onMouseDownLaserHitPanel);
    this.laserHitPanelEl.addEventListener('mouseup', this.onMouseUpLaserHitPanel);

    this.leftHandEl.addEventListener('thumbstickmoved', this.onThumbstickMoved);
    this.rightHandEl.addEventListener('thumbstickmoved', this.onThumbstickMoved);

    // Mouse 2D controls.
    document.addEventListener('mouseup', this.onMouseUp);
    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('mousedown', this.onMouseDown);
    document.addEventListener('wheel', this.onMouseWheel);

    // Mobile 2D controls.
    document.addEventListener('touchend', this.onTouchEnd);
    document.addEventListener('touchmove', this.onTouchMove);

    this.el.sceneEl.addEventListener('enter-vr', this.onEnterVR);
    this.el.sceneEl.addEventListener('exit-vr', this.onExitVR);

    this.modelEl.addEventListener('model-loaded', this.onModelLoaded);
  },

  initUploadInput: function () {
    var uploadContainerEl = this.uploadContainerEl = document.createElement('div');
    var inputEl = this.inputEl = document.createElement('input');
    var submitButtonEl = this.submitButtonEl = document.createElement('button');
    var style = document.createElement('style');
    var css =
      '.a-upload-model  {box-sizing: border-box; display: inline-block; height: 34px; padding: 0; width: 70%;' +
      'bottom: 20px; left: 15%; right: 15%; position: absolute; color: white;' +
      'font-size: 12px; line-height: 12px; border: none;' +
      'border-radius: 5px}' +
      '.a-upload-model.hidden {display: none}' +
      '.a-upload-model-button {cursor: pointer; padding: 0px 2px 0 2px; font-weight: bold; color: #666; border: 3px solid #666; box-sizing: border-box; vertical-align: middle; width: 25%; max-width: 110px; border-radius: 10px; height: 34px; background-color: white; margin: 0;}' +
      '.a-upload-model-button:hover {border-color: #ef2d5e; color: #ef2d5e}' +
      '.a-upload-model-input {color: #666; vertical-align: middle; padding: 0px 10px 0 10px; text-transform: uppercase; border: 0; width: 75%; height: 100%; border-radius: 10px; margin-right: 10px}' +
      '@media only screen and (max-width: 800px) {' +
      '.a-upload-model {margin: auto;}' +
      '.a-upload-model-input {width: 70%;}}' +
      '@media only screen and (max-width: 700px) {' +
      '.a-upload-model {display: none}}';
    var inputDefaultValue = this.inputDefaultValue = 'Copy URL to glTF or glb model';

    if (AFRAME.utils.device.checkARSupport()) {
      css += '@media only screen and (max-width: 800px) {' +
      '.a-upload-model-input {width: 60%;}}';
    }

    uploadContainerEl.classList.add('a-upload-model');
    if (style.styleSheet) {
      style.styleSheet.cssText = css;
    } else {
      style.appendChild(document.createTextNode(css));
    }
    document.getElementsByTagName('head')[0].appendChild(style);

    submitButtonEl.classList.add('a-upload-model-button');
    submitButtonEl.innerHTML = 'OPEN MODEL';
    submitButtonEl.addEventListener('click', this.submitURLButtonClicked);

    inputEl.classList.add('a-upload-model-input');
    inputEl.onfocus = function () {
      if (this.value !== inputDefaultValue) { return; }
      this.value = '';
    };
    inputEl.onblur = function () {
      if (this.value) { return; }
      this.value = inputDefaultValue;
    };

    this.el.sceneEl.addEventListener('infomessageopened', function () {
      uploadContainerEl.classList.add('hidden');
    });
    this.el.sceneEl.addEventListener('infomessageclosed', function () {
      uploadContainerEl.classList.remove('hidden');
    });

    inputEl.value = inputDefaultValue;

    uploadContainerEl.appendChild(inputEl);
    uploadContainerEl.appendChild(submitButtonEl);

    this.el.sceneEl.appendChild(uploadContainerEl);
  },

  update: function () {
    let currentModel =  this.modelEl.components['gltf-model']?.attrValue;
    if (!currentModel) { return; }
    this.el.setAttribute('ar-hit-test', { button: 'squeeze', target: '#baseplateEl', type: 'map' });
    this.el.addEventListener('ar-hit-test-select', this.onArHitTestSelect);
  },

  submitURLButtonClicked: function (evt) {
    const modelURL = this.inputEl.value;
    if (modelURL === this.inputDefaultValue) { return; }

    this.modelEl.setAttribute('gltf-model', modelURL);

    let title = /([^/.]+)(\.[^/]+)?\/?$/.exec(modelURL)?.[1] || "";
    if (title.startsWith("scene")) {
      title = /([^/]+)\/[^/]+$/.exec(modelURL)?.[1] || "";
    }
    const titleEl = document.getElementById(TITLE_ID);
    titleEl.setAttribute('text', 'value: ' + title + '; width: 6');

    this.indicatorEl.left.setAttribute('position', '-1 0 0');
    this.indicatorEl.right.setAttribute('position', '1 0 0');
  },

  initCameraRig: function () {
    var cameraRigEl = this.cameraRigEl = document.createElement('a-entity');
    var cameraEl = this.cameraEl = document.createElement('a-entity');
    var rightHandEl = this.rightHandEl = document.createElement('a-entity');
    var leftHandEl = this.leftHandEl = document.createElement('a-entity');
    this.handEl = {
      'left': leftHandEl,
      'right': rightHandEl
    }
    this.oldHandX = {
      'left': 0,
      'right': 0
    };
    this.oldHandY = {
      'left': 0,
      'right': 0
    };

    cameraRigEl.setAttribute('id', 'cameraRigEl');

    cameraEl.setAttribute('camera', {fov: 60});
    cameraEl.setAttribute('look-controls', {
      magicWindowTrackingEnabled: false,
      mouseEnabled: false,
      touchEnabled: false
    });

    rightHandEl.setAttribute('rotation', '0 90 0');
    rightHandEl.setAttribute('laser-controls', {hand: 'right'});
    rightHandEl.setAttribute('raycaster', {objects: '.raycastable'});
    rightHandEl.setAttribute('line', {color: '#118A7E'});

    leftHandEl.setAttribute('rotation', '0 90 0');
    leftHandEl.setAttribute('laser-controls', {hand: 'left'});
    leftHandEl.setAttribute('raycaster', {objects: '.raycastable'});
    leftHandEl.setAttribute('line', {color: '#118A7E'});

    cameraRigEl.appendChild(cameraEl);
    cameraRigEl.appendChild(rightHandEl);
    cameraRigEl.appendChild(leftHandEl);

    this.el.appendChild(cameraRigEl);
  },

  initBackground: function () {
    var backgroundEl = this.backgroundEl = document.querySelector('a-entity');
    backgroundEl.setAttribute('geometry', {primitive: 'sphere', radius: 65});
    backgroundEl.setAttribute('material', {
      shader: 'background-gradient',
      colorTop: '#37383c',
      colorBottom: '#757575',
      side: 'back'
    });
    backgroundEl.setAttribute('hide-on-enter-ar', '');
  },

  initEntities: function () {
    // This is positioned & oriented by the user in AR, and untranslated elsewhere.
    const baseplateEl = this.baseplateEl = document.createElement('a-triangle');
    // Plane used as a hit target for laser controls when in VR mode
    var laserHitPanelEl = this.laserHitPanelEl = document.createElement('a-entity');
    // Models are often not centered on the 0,0,0.
    // We will center the model and rotate a pivot.
    var modelPivotEl = this.modelPivotEl = document.createElement('a-entity');
    // This is our glTF model entity.
    var modelEl = this.modelEl = document.createElement('a-entity');
    // Shadow blurb for 2D and VR modes. Scaled to match the size of the model.
    var shadowEl = this.shadowEl = document.createElement('a-entity');
    // Real time shadow only used in AR mode.
    var arShadowEl = this.arShadowEl = document.createElement('a-entity');
    // The title / legend displayed above the model.
    var titleEl = this.titleEl = document.createElement('a-entity');
    // Scene lighting.
    var lightEl = this.lightEl = document.createElement('a-entity');
    var sceneLightEl = this.sceneLightEl = document.createElement('a-entity');
    // Laser pointer cursors
    this.indicatorEl = {
      'left': document.createElement('a-cone'),
      'right': document.createElement('a-cone')
    }

    baseplateEl.object3D.name = "baseplate elmt";
    baseplateEl.setAttribute('id', 'baseplateEl');
    baseplateEl.setAttribute('vertex-a', ' .001 0 -.001');
    baseplateEl.setAttribute('vertex-b', '-.001 0 -.001');
    baseplateEl.setAttribute('vertex-c', ' 0   0  .001');

    sceneLightEl.setAttribute('light', {
      type: 'hemisphere',
      intensity: 1
    });
    sceneLightEl.setAttribute('hide-on-enter-ar', '');

    modelPivotEl.object3D.name = "model pivot elmt";
    modelPivotEl.id = 'modelPivot';

    this.el.appendChild(sceneLightEl);

    laserHitPanelEl.id = 'laserHitPanel';
    laserHitPanelEl.setAttribute('id','laserHitPanel');
    laserHitPanelEl.setAttribute('position', '0 0 -10');
    laserHitPanelEl.setAttribute('geometry', 'primitive: plane; width: 30; height: 20');
    laserHitPanelEl.setAttribute('material', 'color: red');
    laserHitPanelEl.setAttribute('visible', 'false');
    laserHitPanelEl.classList.add('raycastable');

    this.el.appendChild(laserHitPanelEl);

    modelEl.classList.add('raycastable');
    modelEl.object3D.name = "model elmt";
    modelEl.setAttribute('rotation', '0 -30 0');
    modelEl.setAttribute('animation-mixer', '');
    modelEl.setAttribute('shadow', 'cast: true; receive: false');
    modelEl.setAttribute('id', 'modelEl');
    modelEl.setAttribute('gltf-model', `resources/styracosaurus_animated.glb`);

    modelPivotEl.appendChild(modelEl);
    modelEl.setAttribute('multiuser', {});

    shadowEl.setAttribute('id', 'shadow elmt');
    shadowEl.setAttribute('rotation', '-90 -30 0');
    shadowEl.setAttribute('geometry', 'primitive: plane; width: 1.0; height: 1.0');
    shadowEl.setAttribute('material', 'src: #shadow; transparent: true; opacity: 0.40');
    shadowEl.setAttribute('hide-on-enter-ar', '');

    modelPivotEl.appendChild(shadowEl);

    arShadowEl.setAttribute('id', 'AR shadow elmt');
    arShadowEl.setAttribute('rotation', '-90 0 0');
    arShadowEl.setAttribute('geometry', 'primitive: plane; width: 30.0; height: 30.0');
    arShadowEl.setAttribute('shadow', 'receive: true');
    arShadowEl.setAttribute('ar-shadows', 'opacity: 0.2');
    arShadowEl.setAttribute('visible', 'false');

    this.el.addEventListener('ar-hit-test-select-start', function () {
      arShadowEl.object3D.visible = false;
    });

    this.el.addEventListener('ar-hit-test-select', function () {
      arShadowEl.object3D.visible = true;
    });

    this.el.appendChild(arShadowEl);

    titleEl.id = TITLE_ID;
    titleEl.setAttribute('text', 'value: ' + 'Styracosaurus' + '; width: 6');
    titleEl.setAttribute('hide-on-enter-ar', '');
    titleEl.setAttribute('visible', 'false');
    titleEl.setAttribute('multiuser', {});

    this.baseplateEl.appendChild(titleEl);

    lightEl.id = 'light';
    lightEl.setAttribute('position', '-2 4 2');
    lightEl.setAttribute('light', {
      type: 'hemisphere',
      color: '#fff',
      groundColor: '#444',
      castShadow: false,
      intensity: 0.5,
    });

    this.el.appendChild(lightEl);

    this.baseplateEl.appendChild(modelPivotEl);

    this.el.appendChild(baseplateEl);
  },

  onThumbstickMoved: function (evt) {
    var modelPivotEl = this.modelPivotEl;
    var modelScale = this.modelScale || modelPivotEl.object3D.scale.x;
    modelScale -= evt.detail.y / 20;
    modelScale = Math.min(Math.max(0.8, modelScale), 2.0);
    modelPivotEl.object3D.scale.set(modelScale, modelScale, modelScale);
    this.modelScale = modelScale;
  },

  onMouseWheel: function (evt) {
    var modelPivotEl = this.modelPivotEl;
    var modelScale = this.modelScale || modelPivotEl.object3D.scale.x;
    modelScale -= evt.deltaY / 100;
    modelScale = Math.min(Math.max(0.8, modelScale), 2.0);
    // Clamp scale.
    modelPivotEl.object3D.scale.set(modelScale, modelScale, modelScale);
    this.modelScale = modelScale;
  },

  onMouseDownLaserHitPanel: function (evt) {
    var cursorEl = evt.detail.cursorEl;
    var intersection = cursorEl.components.raycaster.getIntersection(this.laserHitPanelEl);
    if (!intersection) { return; }
    cursorEl.setAttribute('raycaster', 'lineColor', 'white');
    this.activeHandEl = cursorEl;
    this.oldHandX = {
      'left': undefined,
      'right': undefined
    };
    this.oldHandY = {
      'left': undefined,
      'right': undefined
    };
  },

  onMouseUpLaserHitPanel: function (evt) {
    var cursorEl = evt.detail.cursorEl;
    if (cursorEl === this.leftHandEl) { this.leftHandPressed = false; }
    if (cursorEl === this.rightHandEl) { this.rightHandPressed = false; }
    cursorEl.setAttribute('raycaster', 'lineColor', 'white');
    if (this.activeHandEl === cursorEl) { this.activeHandEl = undefined; }
  },

  onOrientationChange: function () {
    if (AFRAME.utils.device.isLandscape()) {
      this.cameraRigEl.object3D.position.z -= 1;
    } else {
      this.cameraRigEl.object3D.position.z += 1;
    }
  },

  tick: function () {
    var modelPivotEl = this.modelPivotEl;
    var laserHitPanelEl = this.laserHitPanelEl;
    var activeHandEl = this.activeHandEl;
    const position = new THREE.Vector3();
    const normal = new THREE.Vector3();
    const rotationQuaternion = new THREE.Quaternion();

    if (this.el.sceneEl.is('vr-mode')) {
      if (!activeHandEl) { return; }
      const intersection = activeHandEl.components.raycaster.getIntersection(laserHitPanelEl);
      if (!intersection) {
        activeHandEl.setAttribute('raycaster', 'lineColor', 'white');
      } else {
        activeHandEl.setAttribute('raycaster', 'lineColor', '#007AFF');
        const intersectionPosition = intersection.point;
        const hand = activeHandEl === this.handEl.left ? 'left' : 'right';
        this.oldHandX[hand] = this.oldHandX[hand] || intersectionPosition.x;
        this.oldHandY[hand] = this.oldHandY[hand] || intersectionPosition.y;

        modelPivotEl.object3D.rotation.y -= (this.oldHandX[hand] - intersectionPosition.x) / 4;
        modelPivotEl.object3D.rotation.x += (this.oldHandY[hand] - intersectionPosition.y) / 4;

        this.oldHandX[hand] = intersectionPosition.x;
        this.oldHandY[hand] = intersectionPosition.y;
      }
    } else if (this.el.sceneEl.is('ar-mode')) {
      for (const hand of ['left', 'right']) {
        const intersection = this.handEl[hand].components.raycaster.intersections[0];
        if (!intersection) {
          this.handEl[hand].setAttribute('raycaster', 'lineColor', 'white');
        } else {
          this.handEl[hand].setAttribute('raycaster', 'lineColor', '#007AFF');
          const intersectionPosition = intersection.point;
          this.oldHandX[hand] = this.oldHandX[hand] || intersectionPosition.x;
          this.oldHandY[hand] = this.oldHandY[hand] || intersectionPosition.y;

          position.copy(intersection.point);
          this.modelPivotEl.object3D.worldToLocal(position);
          this.indicatorEl[hand].setAttribute('position', position);

          // normal.copy(intersection.normal).normalize().applyNormalMatrix(intersection.object.normalMatrix);
          const up = new THREE.Vector3(0, 1, 0);
          // up.applyQuaternion(this.anchorQuaternion);
          rotationQuaternion.setFromUnitVectors(up, intersection.normal);
          // rotationQuaternion.premultiply(this.anchorQuaternion);
          this.indicatorEl[hand].setAttribute('rotationquaternion', rotationQuaternion);

          this.oldHandX[hand] = intersectionPosition.x;
          this.oldHandY[hand] = intersectionPosition.y;
        }
      }
    }
  },

  onEnterVR: function () {
    if (this.el.sceneEl.is('vr-mode')) {
      this.baseplateEl.object3D.position.y = 1.6;
    }

    var cameraRigEl = this.cameraRigEl;

    this.cameraRigPosition = cameraRigEl.object3D.position.clone();
    this.cameraRigRotation = cameraRigEl.object3D.rotation.clone();

    if (!this.el.sceneEl.is('ar-mode')) {
      cameraRigEl.object3D.position.set(0, 0, 2);
    } else {
      cameraRigEl.object3D.position.set(0, 0, 0);
    }

    for (const hand of ['left', 'right']) {
      this.createIndicator(hand);
    }
  },

  onExitVR: function () {
    this.baseplateEl.object3D.position.y = 0;

    var cameraRigEl = this.cameraRigEl;

    cameraRigEl.object3D.position.copy(this.cameraRigPosition);
    cameraRigEl.object3D.rotation.copy(this.cameraRigRotation);

    cameraRigEl.object3D.rotation.set(0, 0, 0);
    for (const hand of ['left', 'right']) {
      this.modelPivotEl.removeChild(this.indicatorEl[hand]);
    }
  },

  createIndicator: function (hand) {
    this.indicatorEl[hand].setAttribute('radius-top', 0.02);
    this.indicatorEl[hand].setAttribute('radius-bottom', 0);
    this.indicatorEl[hand].setAttribute('height', INDICATOR_LENGTH);
    this.indicatorEl[hand].setAttribute('color', this.el.sceneEl.dataset.userColor || '#666');

    // const cone = document.createElement('a-cone');
    // cone.object3D.name = `${hand} indicator cone`;
    // cone.setAttribute('id', `${hand}IndicatorCone-${this.el.sceneEl.dataset.viewId}`)
    // cone.setAttribute('radius-top', INDICATOR_RADIUS);
    // cone.setAttribute('radius-bottom', 0);
    // cone.setAttribute('height', INDICATOR_LENGTH);
    // cone.setAttribute('color', this.el.sceneEl.dataset.userColor || 'teal');
    // cone.setAttribute('position', {x: 0, y:INDICATOR_LENGTH/2, z: 0});
    // this.indicatorEl[hand].appendChild(cone);
    //
    // const dome = document.createElement('a-sphere');
    // dome.object3D.name = `${hand} indicator dome`;
    // dome.setAttribute('id', `${hand}IndicatorDome-${this.el.sceneEl.dataset.viewId}`)
    // dome.setAttribute('radius', INDICATOR_RADIUS);
    // dome.setAttribute('theta-start', 0);
    // dome.setAttribute('theta-length', 90);
    // dome.setAttribute('color', 'left' === hand ? 'blue' : 'red');
    // dome.setAttribute('position', {x: 0, y:INDICATOR_LENGTH, z: 0});
    // this.indicatorEl[hand].appendChild(dome);

    this.indicatorEl[hand].object3D.name = `${hand} indicator`;
    this.indicatorEl[hand].setAttribute('id', `${hand}Indicator-${this.el.sceneEl.dataset.viewId}`);
    this.indicatorEl[hand].setAttribute('position', 'left' === hand ? '-1 0 0' : '1 0 0');
    this.indicatorEl[hand].setAttribute('multiuser', {});
    this.modelPivotEl.appendChild(this.indicatorEl[hand]);
  },

  onTouchMove: function (evt) {
    if (evt.touches.length === 1) { this.onSingleTouchMove(evt); }
    if (evt.touches.length === 2) { this.onPinchMove(evt); }
  },

  onSingleTouchMove: function (evt) {
    var dX;
    var dY;
    var modelPivotEl = this.modelPivotEl;
    this.oldClientX = this.oldClientX || evt.touches[0].clientX;
    this.oldClientY = this.oldClientY || evt.touches[0].clientY;

    dX = this.oldClientX - evt.touches[0].clientX;
    dY = this.oldClientY - evt.touches[0].clientY;

    modelPivotEl.object3D.rotation.y -= dX / 200;
    this.oldClientX = evt.touches[0].clientX;

    modelPivotEl.object3D.rotation.x -= dY / 100;

    // Clamp x rotation to [-90,90]
    modelPivotEl.object3D.rotation.x = Math.min(Math.max(-Math.PI / 2, modelPivotEl.object3D.rotation.x), Math.PI / 2);
    this.oldClientY = evt.touches[0].clientY;
  },

  onPinchMove: function (evt) {
    var dX = evt.touches[0].clientX - evt.touches[1].clientX;
    var dY = evt.touches[0].clientY - evt.touches[1].clientY;
    var modelPivotEl = this.modelPivotEl;
    var distance = Math.sqrt(dX * dX + dY * dY);
    var oldDistance = this.oldDistance || distance;
    var distanceDifference = oldDistance - distance;
    var modelScale = this.modelScale || modelPivotEl.object3D.scale.x;

    modelScale -= distanceDifference / 500;
    modelScale = Math.min(Math.max(0.8, modelScale), 2.0);
    // Clamp scale.
    modelPivotEl.object3D.scale.set(modelScale, modelScale, modelScale);

    this.modelScale = modelScale;
    this.oldDistance = distance;
  },

  onTouchEnd: function (evt) {
    this.oldClientX = undefined;
    this.oldClientY = undefined;
    if (evt.touches.length < 2) { this.oldDistance = undefined; }
  },

  onMouseUp: function (evt) {
    this.leftRightButtonPressed = false;
    if (evt.buttons === undefined || evt.buttons !== 0) { return; }
    this.oldClientX = undefined;
    this.oldClientY = undefined;
  },

  onMouseMove: function (evt) {
    if (this.leftRightButtonPressed) {
      this.dragModel(evt);
    } else {
      this.rotateModel(evt);
    }
  },

  dragModel: function (evt) {
    var dX;
    var dY;
    var modelPivotEl = this.modelPivotEl;
    if (!this.oldClientX) { return; }
    dX = this.oldClientX - evt.clientX;
    dY = this.oldClientY - evt.clientY;
    modelPivotEl.object3D.position.y += dY / 200;
    modelPivotEl.object3D.position.x -= dX / 200;
    this.oldClientX = evt.clientX;
    this.oldClientY = evt.clientY;
  },

  rotateModel: function (evt) {
    var dX;
    var dY;
    var modelPivotEl = this.modelPivotEl;
    if (!this.oldClientX) { return; }
    dX = this.oldClientX - evt.clientX;
    dY = this.oldClientY - evt.clientY;
    modelPivotEl.object3D.rotation.y -= dX / 100;
    modelPivotEl.object3D.rotation.x -= dY / 200;

    // Clamp x rotation to [-90,90]
    modelPivotEl.object3D.rotation.x = Math.min(Math.max(-Math.PI / 2, modelPivotEl.object3D.rotation.x), Math.PI / 2);

    this.oldClientX = evt.clientX;
    this.oldClientY = evt.clientY;
  },

  onModelLoaded: function () {
    this.centerAndScaleModel();
  },

  onArHitTestSelect: function (evt) {
    this.anchorQuaternion.copy(evt.detail.orientation);
    this.anchorRotation.setFromQuaternion(this.anchorQuaternion, 'XYZ');
    console.info("onArHitTestSelect", this.anchorQuaternion, this.anchorRotation)
    this.indicatorEl.left.setAttribute('position', '-1 0 0');
    this.indicatorEl.right.setAttribute('position', '1 0 0');
  },

  centerAndScaleModel: function () {
    var box;
    var size;
    var center;
    var scale;
    var modelEl = this.modelEl;
    var shadowEl = this.shadowEl;
    var titleEl = this.titleEl;
    var gltfObject = modelEl.getObject3D('mesh');

    // Reset position and scales.
    modelEl.object3D.position.set(0, 0, 0);
    modelEl.object3D.scale.set(1.0, 1.0, 1.0);
    this.cameraRigEl.object3D.position.z = 3.0;

    // Calculate model size.
    modelEl.object3D.updateMatrixWorld();
    box = new THREE.Box3().setFromObject(gltfObject);
    size = box.getSize(new THREE.Vector3());

    // Calculate scale factor to resize model to human scale.
    scale = 1.0 / size.y;
    scale = 1.5 / size.x < scale ? 1.5 / size.x : scale;
    scale = 1.5 / size.z < scale ? 1.5 / size.z : scale;

    modelEl.object3D.scale.set(scale, scale, scale);

    // Center model at (0, 0, 0).
    modelEl.object3D.updateMatrixWorld();
    box = new THREE.Box3().setFromObject(gltfObject);
    center = box.getCenter(new THREE.Vector3());
    size = box.getSize(new THREE.Vector3());

    shadowEl.object3D.scale.y = size.x;
    shadowEl.object3D.scale.x = size.y;
    shadowEl.object3D.position.y = -size.y / 2;
    shadowEl.object3D.position.z = -center.z;
    shadowEl.object3D.position.x = -center.x;

    titleEl.object3D.position.x = 2.2 - center.x;
    titleEl.object3D.position.y = size.y + 0.5;
    titleEl.object3D.position.z = -2;
    titleEl.object3D.visible = true;

    modelEl.object3D.position.x = -center.x;
    modelEl.object3D.position.y = -center.y;
    modelEl.object3D.position.z = -center.z;

    // When in mobile landscape we want to bring the model a bit closer.
    if (AFRAME.utils.device.isLandscape()) { this.cameraRigEl.object3D.position.z -= 1; }
  },

  onMouseDown: function (evt) {
    if (evt.buttons) { this.leftRightButtonPressed = evt.buttons === 3; }
    this.oldClientX = evt.clientX;
    this.oldClientY = evt.clientY;
  }
});
