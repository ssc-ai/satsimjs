import { jest } from '@jest/globals'

function makeElement(tagName = 'div') {
  return {
    tagName,
    className: '',
    style: {},
    width: 0,
    height: 0,
    appendChild: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    querySelector: jest.fn().mockReturnValue(null),
    getBoundingClientRect: jest.fn().mockReturnValue({ left: 0, top: 0, width: 100, height: 100 }),
    getContext: jest.fn().mockReturnValue({
      clearRect: jest.fn(),
      beginPath: jest.fn(),
      closePath: jest.fn(),
      moveTo: jest.fn(),
      lineTo: jest.fn(),
      arc: jest.fn(),
      stroke: jest.fn(),
      fill: jest.fn(),
      fillText: jest.fn(),
      save: jest.fn(),
      restore: jest.fn(),
      translate: jest.fn(),
      rotate: jest.fn(),
      setLineDash: jest.fn()
    }),
    clientWidth: 100,
    clientHeight: 100
  }
}

global.document = {
  createElement: jest.fn((tagName) => makeElement(tagName))
}

jest.mock('cesium', () => {
  class MockPrimitiveCollection {
    constructor() {
      this.show = true
    }

    add(item) {
      return item
    }

    remove(item) {
      return item
    }
  }

  class Cartesian3 {
    constructor(x = 0, y = 0, z = 0) {
      this.x = x
      this.y = y
      this.z = z
    }

    static clone(value, result) {
      const out = result ?? new Cartesian3()
      out.x = value?.x ?? 0
      out.y = value?.y ?? 0
      out.z = value?.z ?? 0
      return out
    }
  }

  Cartesian3.UNIT_X = new Cartesian3(1, 0, 0)
  Cartesian3.UNIT_Y = new Cartesian3(0, 1, 0)
  Cartesian3.UNIT_Z = new Cartesian3(0, 0, 1)

  function makeColor(label) {
    return {
      label,
      alpha: 1,
      withAlpha: jest.fn().mockReturnThis()
    }
  }

  const colorStub = makeColor('default')

  class Matrix4 {}

  Matrix4.multiply = jest.fn((left, right, result) => result ?? new Matrix4())
  Matrix4.multiplyByPoint = jest.fn((transform, point, result) => result ?? point)
  Matrix4.multiplyByPointAsVector = jest.fn((transform, point, result) => result ?? point)
  Matrix4.fromRotationTranslation = jest.fn()
  Matrix4.clone = jest.fn((value) => value)

  const Color = {
    WHITE: colorStub,
    WHEAT: colorStub,
    BLACK: colorStub,
    RED: colorStub,
    ORANGE: colorStub,
    YELLOW: colorStub,
    GREEN: colorStub,
    GRAY: colorStub,
    PURPLE: colorStub,
    clone: jest.fn((value) => value),
    equals: jest.fn().mockReturnValue(false),
    fromCssColorString: jest.fn((value) => makeColor(value)),
    fromBytes: jest.fn((r, g, b, a) => makeColor(`bytes:${r},${g},${b},${a}`))
  }

  return {
    JulianDate: class JulianDate {},
    PointPrimitiveCollection: MockPrimitiveCollection,
    BillboardCollection: MockPrimitiveCollection,
    LabelCollection: MockPrimitiveCollection,
    Viewer: class Viewer {},
    ImageryLayer: { fromProviderAsync: jest.fn() },
    UrlTemplateImageryProvider: class UrlTemplateImageryProvider {},
    IonImageryProvider: { fromAssetId: jest.fn() },
    buildModuleUrl: jest.fn((value) => value),
    TileMapServiceImageryProvider: { fromUrl: jest.fn() },
    defined: (value) => value !== undefined && value !== null,
    Math: {
      toRadians: jest.fn((value) => value * Math.PI / 180),
      RADIANS_PER_DEGREE: Math.PI / 180,
      EPSILON1: 0.1
    },
    Cartesian2: class Cartesian2 {},
    Cartesian3,
    Matrix4,
    Color,
    SceneMode: { SCENE3D: 3 },
    ReferenceFrame: { FIXED: 'FIXED', INERTIAL: 'INERTIAL' },
    PostProcessStage: class PostProcessStage {},
    EntityView: class EntityView {},
    Entity: class Entity {},
    Clock: class Clock {},
    Camera: class Camera {},
    SceneTransforms: {
      wgs84ToWindowCoordinates: jest.fn()
    }
  }
})

jest.mock('../src/widgets/InfoBox.js', () => {
  return jest.fn().mockImplementation(() => ({
    viewModel: {
      cameraClicked: {},
      closeClicked: {}
    }
  }))
})

jest.mock('../src/widgets/Toolbar.js', () => {
  return jest.fn().mockImplementation(() => {
    const addToolbarMenu = jest.fn((options, menu) => {
      const targetMenu = menu ?? {
        userOptions: [],
        appendChild: jest.fn(),
        enable: jest.fn(),
        selectedIndex: -1
      }
      if (!Array.isArray(targetMenu.userOptions)) {
        targetMenu.userOptions = []
      }
      targetMenu.userOptions.push(...options)
      return targetMenu
    })

    return {
      addToggleButton: jest.fn((text, checked) => ({ text, checked, enable: jest.fn() })),
      addToolbarMenu,
      addToolbarButton: jest.fn(() => ({ enable: jest.fn() })),
      addToolbarInput: jest.fn(() => ({ enable: jest.fn() })),
      addToolbarComboMenu: jest.fn(() => ({
        container: { addEventListener: jest.fn(), contains: jest.fn().mockReturnValue(false) },
        input: { addEventListener: jest.fn(), value: '', focus: jest.fn() },
        menu: { userOptions: [], appendChild: jest.fn(), enable: jest.fn(), selectedIndex: -1, style: {}, addEventListener: jest.fn() },
        enable: jest.fn(),
        showMenu: jest.fn(),
        hideMenu: jest.fn()
      })),
      addSeparator: jest.fn(),
      clear: jest.fn()
    }
  })
})

jest.mock('../src/engine/cesium/SensorFieldOfRegardVisualizer.js', () => {
  return jest.fn().mockImplementation(() => ({ show: false }))
})

jest.mock('../src/engine/cesium/SensorFieldOfVIewVisualizer.js', () => {
  return jest.fn().mockImplementation(() => ({ show: true }))
})

jest.mock('../src/engine/cesium/LaserBeam.js', () => {
  return jest.fn().mockImplementation(() => ({ show: true }))
})

jest.mock('../src/engine/cesium/GeoBeltVisualizer.js', () => {
  return jest.fn().mockImplementation(() => ({ show: true }))
})

jest.mock('../src/engine/cesium/CallbackPositionProperty.js', () => {
  return jest.fn().mockImplementation(() => ({}))
})

jest.mock('../src/engine/cesium/utils.js', () => ({
  createObjectPositionProperty: jest.fn(() => ({})),
  createObjectOrientationProperty: jest.fn(() => ({})),
  getObjectPositionInCesiumFrame: jest.fn(() => ({}))
}))

jest.mock('../src/engine/cesium/CoverageGridVisualizer.js', () => {
  return jest.fn().mockImplementation(() => ({ show: false, update: jest.fn() }))
})

jest.mock('../src/index.js', () => ({
  CompoundElementVisualizer: class CompoundElementVisualizer {}
}))

jest.mock('../src/engine/objects/SimObject.js', () => {
  return class SimObject {}
})

jest.mock('../src/engine/objects/ElectroOpticalSensor.js', () => {
  return class ElectroOpticalSensor {}
})

jest.mock('../src/engine/objects/Observatory.js', () => {
  return class Observatory {
    constructor(site, gimbal, sensors) {
      this.site = site
      this.gimbal = gimbal
      this.sensors = Array.isArray(sensors) ? sensors : [sensors]
      this.sensor = this.sensors[0]
    }
  }
})

jest.mock('../src/engine/geometry/shadow.js', () => ({
  getShadowStatus: jest.fn(() => []),
  ShadowState: {
    UMBRA: 'UMBRA',
    PENUMBRA: 'PENUMBRA'
  }
}))

import { mixinViewer } from '../src/widgets/Viewer.js'
import Observatory from '../src/engine/objects/Observatory.js'
import SensorFieldOfRegardVisualizer from '../src/engine/cesium/SensorFieldOfRegardVisualizer.js'
import SensorFieldOfViewVisualizer from '../src/engine/cesium/SensorFieldOfVIewVisualizer.js'
import LaserBeam from '../src/engine/cesium/LaserBeam.js'

function makeViewerStub() {
  return {
    scene: {
      imageryLayers: { add: jest.fn() },
      screenSpaceCameraController: { update: jest.fn() },
      primitives: { add: jest.fn((value) => value) },
      globe: {},
      skyAtmosphere: {},
      fog: {},
      skyBox: {},
      preRender: { addEventListener: jest.fn() },
      preUpdate: { addEventListener: jest.fn() },
      postRender: { addEventListener: jest.fn() },
      morphComplete: { addEventListener: jest.fn() },
      postProcessStages: { add: jest.fn() },
      pick: jest.fn(),
      morphTo2D: jest.fn(),
      morphToColumbusView: jest.fn(),
      mode: 3,
      context: {}
    },
    camera: {
      frustum: { aspectRatio: 1, fov: 0 },
      direction: {},
      positionWC: {},
      position: {},
      directionWC: {},
      upWC: {},
      up: {},
      rightWC: {},
      right: {},
      transform: {},
      setView: jest.fn(),
      lookAtTransform: jest.fn(),
      flyHome: jest.fn(),
      _setTransform: jest.fn()
    },
    _selectionIndicator: {},
    _eventHelper: { add: jest.fn() },
    clock: { onTick: {}, currentTime: {} },
    entities: {
      add: jest.fn((value) => value),
      remove: jest.fn()
    },
    _element: makeElement('div'),
    cesiumWidget: {},
    zoomTo: jest.fn(),
    boundingSphereScratch: {}
  }
}

describe('Viewer observatory behavior', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('renders one site and one sensor visualizer per sensor, and exposes per-sensor toolbar toggles', () => {
    const viewer = makeViewerStub()
    const universe = {
      earth: {
        update: jest.fn(),
        worldToLocalTransform: {}
      },
      _trackables: []
    }

    mixinViewer(viewer, universe, {
      infoBox2: false,
      toolbar2: false,
      showNightLayer: false,
      showWeatherLayer: false,
      enableObjectSearch: false
    })

    viewer.addSiteVisualizer = jest.fn()
    viewer.addSensorVisualizer = jest.fn()

    const sensor1 = {
      name: 'HSV Narrow',
      visualizer: {
        fieldOfRegard: { show: false },
        fieldOfView: { show: true }
      }
    }
    const sensor2 = {
      name: 'HSV Wide',
      visualizer: {
        fieldOfRegard: { show: true },
        fieldOfView: { show: false }
      }
    }
    const observatory = new Observatory({ name: 'HSV Laser Test Range' }, { name: 'HSV Gimbal' }, [sensor1, sensor2])

    viewer.addObservatoryVisualizer(observatory, 'desc')

    expect(viewer.addSiteVisualizer).toHaveBeenCalledTimes(1)
    expect(viewer.addSensorVisualizer).toHaveBeenCalledTimes(2)
    expect(viewer.addSensorVisualizer).toHaveBeenNthCalledWith(1, observatory.site, observatory.gimbal, sensor1)
    expect(viewer.addSensorVisualizer).toHaveBeenNthCalledWith(2, observatory.site, observatory.gimbal, sensor2)

    const toolbar = { addToggleButton: jest.fn() }
    viewer.applyDefaultToolbar(toolbar, { simObjectRef: observatory })

    expect(toolbar.addToggleButton).toHaveBeenNthCalledWith(
      1,
      'Field of Regard: HSV Narrow',
      false,
      expect.any(Function)
    )
    expect(toolbar.addToggleButton).toHaveBeenNthCalledWith(
      2,
      'Field of View: HSV Narrow',
      true,
      expect.any(Function)
    )
    expect(toolbar.addToggleButton).toHaveBeenNthCalledWith(
      3,
      'Field of Regard: HSV Wide',
      true,
      expect.any(Function)
    )
    expect(toolbar.addToggleButton).toHaveBeenNthCalledWith(
      4,
      'Field of View: HSV Wide',
      false,
      expect.any(Function)
    )
  })

  test('passes sensor color through to FoR and FoV visualizers', () => {
    const viewer = makeViewerStub()
    const universe = {
      earth: {
        update: jest.fn(),
        worldToLocalTransform: {}
      },
      _trackables: []
    }

    mixinViewer(viewer, universe, {
      infoBox2: false,
      toolbar2: false,
      showNightLayer: false,
      showWeatherLayer: false,
      enableObjectSearch: false
    })

    const site = { name: 'HSV Laser Test Range' }
    const gimbal = { name: 'HSV Gimbal' }
    const sensor = { name: 'HSV Red Sensor', color: '#ff0000', visualizer: {} }

    viewer.addSensorVisualizer(site, gimbal, sensor)

    const forColor = SensorFieldOfRegardVisualizer.mock.calls[0][4]
    const fovColor = SensorFieldOfViewVisualizer.mock.calls[0][5]
    expect(forColor?.label).toBe('#ff0000')
    expect(fovColor?.label).toBe('#ff0000')
  })

  test('dispatches laser payloads to LaserBeam and preserves the fieldOfView alias', () => {
    const viewer = makeViewerStub()
    const universe = {
      earth: {
        update: jest.fn(),
        worldToLocalTransform: {}
      },
      _trackables: []
    }

    mixinViewer(viewer, universe, {
      infoBox2: false,
      toolbar2: false,
      showNightLayer: false,
      showWeatherLayer: false,
      enableObjectSearch: false
    })

    const site = { name: 'HSV Laser Test Range' }
    const gimbal = { name: 'HSV Gimbal' }
    const laser = { name: 'HSV HEL', type: 'Laser', color: '#ff0000', visualizer: {} }

    viewer.addSensorVisualizer(site, gimbal, laser)

    expect(LaserBeam).toHaveBeenCalledWith(viewer, laser, universe, expect.anything())
    expect(SensorFieldOfRegardVisualizer).not.toHaveBeenCalled()
    expect(SensorFieldOfViewVisualizer).not.toHaveBeenCalled()
    expect(laser.visualizer.beam).toBe(laser.visualizer.fieldOfView)
    expect(laser.visualizer.fieldOfRegard).toBeUndefined()
    expect(viewer.beamVisualizers).toHaveLength(1)
    expect(viewer.sensorFovVisualizers).toHaveLength(0)
  })

  test('adds a single beam toolbar toggle for laser payloads', () => {
    const viewer = makeViewerStub()
    const universe = {
      earth: {
        update: jest.fn(),
        worldToLocalTransform: {}
      },
      _trackables: []
    }

    mixinViewer(viewer, universe, {
      infoBox2: false,
      toolbar2: false,
      showNightLayer: false,
      showWeatherLayer: false,
      enableObjectSearch: false
    })

    const beam = { show: true }
    const laser = {
      name: 'HSV HEL',
      type: 'Laser',
      visualizer: {
        beam,
        fieldOfView: beam
      }
    }
    const observatory = new Observatory({ name: 'HSV Laser Test Range' }, { name: 'HSV Gimbal' }, [laser])

    const toolbar = { addToggleButton: jest.fn() }
    viewer.applyDefaultToolbar(toolbar, { simObjectRef: observatory })

    expect(toolbar.addToggleButton).toHaveBeenCalledTimes(1)
    expect(toolbar.addToggleButton).toHaveBeenCalledWith(
      'Beam: HSV HEL',
      true,
      expect.any(Function)
    )
  })

  test('updates sensor-view camera frustum when sensor zoom changes', () => {
    const viewer = makeViewerStub()
    viewer.scene.context = {
      drawingBufferWidth: 1600,
      drawingBufferHeight: 900
    }

    const universe = {
      earth: {
        update: jest.fn(),
        worldToLocalTransform: {}
      },
      _trackables: []
    }

    mixinViewer(viewer, universe, {
      infoBox2: false,
      toolbar2: false,
      showNightLayer: false,
      showWeatherLayer: false,
      enableObjectSearch: false
    })

    const updateCamera = viewer.scene.preRender.addEventListener.mock.calls[0][0]
    const sensor = {
      name: 'HSV Zoom Sensor',
      x_fov: 5,
      y_fov: 5,
      update: jest.fn(),
      localToWorldTransform: {},
      parent: { parent: { localToWorldTransform: {} } },
      visualizer: {}
    }

    viewer.setCameraMode('sensor', sensor)
    updateCamera(viewer.scene, {})
    const initialFov = viewer.camera.frustum.fov

    sensor.x_fov = 0.05
    sensor.y_fov = 0.05
    updateCamera(viewer.scene, {})

    expect(viewer.camera.frustum.aspectRatio).toBeCloseTo(1600 / 900, 8)
    expect(viewer.camera.frustum.fov).toBeLessThan(initialFov)
  })

  test('syncs the camera view selector when camera mode changes programmatically', () => {
    const viewer = makeViewerStub()
    const universe = {
      earth: {
        update: jest.fn(),
        worldToLocalTransform: {}
      },
      _trackables: []
    }

    mixinViewer(viewer, universe, {
      infoBox2: false,
      toolbar2: false,
      showNightLayer: false,
      showWeatherLayer: false,
      enableObjectSearch: false
    })

    const sensor = {
      name: 'HSV Zoom Sensor',
      update: jest.fn(),
      localToWorldTransform: {},
      parent: { parent: { localToWorldTransform: {} } },
      visualizer: {}
    }

    viewer.addSensorVisualizer({ name: 'HSV Laser Test Range' }, { name: 'HSV Gimbal' }, sensor)

    const cameraViewMenu = viewer.toolbar.addToolbarMenu.mock.results[0].value

    expect(cameraViewMenu.selectedIndex).toBe(-1)

    viewer.setCameraMode('sensor', sensor)
    expect(cameraViewMenu.selectedIndex).toBe(1)

    viewer.setCameraMode('up', sensor)
    expect(cameraViewMenu.selectedIndex).toBe(2)

    viewer.setCameraMode('world')
    expect(cameraViewMenu.selectedIndex).toBe(0)
  })

  test('disables FoV visualizers while keeping the toolbar toggle in sync', () => {
    const viewer = makeViewerStub()
    const universe = {
      earth: {
        update: jest.fn(),
        worldToLocalTransform: {}
      },
      _trackables: []
    }

    mixinViewer(viewer, universe, {
      infoBox2: false,
      toolbar2: false,
      showNightLayer: false,
      showWeatherLayer: false,
      enableObjectSearch: false
    })

    const sensor = {
      name: 'HSV Zoom Sensor',
      visualizer: {}
    }

    viewer.addSensorVisualizer({ name: 'HSV Laser Test Range' }, { name: 'HSV Gimbal' }, sensor)

    const sensorFieldOfViewButton = viewer.toolbar.addToggleButton.mock.results[2].value

    expect(sensorFieldOfViewButton.checked).toBe(true)
    expect(viewer.sensorFovVisualizers[0].show).toBe(true)

    viewer.setSensorFieldOfViewEnabled(false)

    expect(sensorFieldOfViewButton.checked).toBe(false)
    expect(viewer.sensorFovVisualizers[0].show).toBe(false)
  })

  test('tracked-object menu exits sensor view without flying home before tracking the object', () => {
    const viewer = makeViewerStub()
    const universe = {
      earth: {
        update: jest.fn(),
        worldToLocalTransform: {}
      },
      _trackables: []
    }

    mixinViewer(viewer, universe, {
      infoBox2: false,
      toolbar2: false,
      showNightLayer: false,
      showWeatherLayer: false,
      enableObjectSearch: false
    })

    const sensor = {
      name: 'HSV Zoom Sensor',
      update: jest.fn(),
      localToWorldTransform: {},
      parent: { parent: { localToWorldTransform: {} } },
      visualizer: {}
    }
    viewer.addSensorVisualizer({ name: 'HSV Laser Test Range' }, { name: 'HSV Gimbal' }, sensor)
    viewer.setCameraMode('sensor', sensor)

    const object = { name: 'Drone-Alpha' }
    viewer.addObjectVisualizer(object, 'desc', {})

    const trackedObjectCombo = viewer.toolbar.addToolbarComboMenu.mock.results[0].value
    trackedObjectCombo.menu.userOptions[0].onselect()

    expect(viewer.cameraMode).toBe('world')
    expect(viewer.camera.flyHome).not.toHaveBeenCalled()
    expect(viewer.trackedEntity).toBe(object.visualizer)
    expect(viewer.selectedEntity).toBe(object.visualizer)
  })
})
