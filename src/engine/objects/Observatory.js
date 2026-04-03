import ElectroOpicalSensor from "./ElectroOpticalSensor.js";
import Gimbal from "./Gimbal.js";
import SimObject from "./SimObject.js";

/**
 * Normalize observatory sensor input into an array while preserving the input
 * objects by reference.
 *
 * @param {ElectroOpicalSensor|import('./Laser.js').default|Array<ElectroOpicalSensor|import('./Laser.js').default>|undefined} input
 * @returns {Array<ElectroOpicalSensor|import('./Laser.js').default|undefined>}
 */
function normalizeSensors(input) {
    if (Array.isArray(input)) {
        return input.slice();
    }
    if (arguments.length > 0) {
        return [input];
    }
    return [];
}

/**
 * Represents an observatory object.
 * @class
 */
class Observatory {

    /**
     * Creates an instance of Observatory.
     * @param {SimObject} site - The site object.
     * @param {Gimbal} gimbal - The gimbal object.
     * @param {ElectroOpicalSensor|import('./Laser.js').default|Array<ElectroOpicalSensor|import('./Laser.js').default>} sensor - The payload object(s).
     * @param {import('./FastSteeringMirror.js').default} [fsm] - Optional fast steering mirror.
     */
    constructor(site, gimbal, sensor, fsm = undefined) {
        this._site = site;
        this._gimbal = gimbal;
        this._fsm = fsm;
        this.sensors = sensor;
    }

    /**
     * Gets the site object.
     * @returns {SimObject} The site object.
     */
    get site() {
        return this._site;
    }

    /**
     * Sets the site object.
     * @param {SimObject} value - The site object.
     */
    set site(value) {
        this._site = value;
    }

    /**
     * Gets the gimbal object.
     * @returns {Gimbal} The gimbal object.
     */
    get gimbal() {
        return this._gimbal;
    }

    /**
     * Sets the gimbal object.
     * @param {Gimbal} value - The gimbal object.
     */
    set gimbal(value) {
        this._gimbal = value;
    }

    /**
     * Gets the fast steering mirror object.
     * @returns {import('./FastSteeringMirror.js').default|undefined} The FSM object.
     */
    get fsm() {
        return this._fsm;
    }

    /**
     * Sets the fast steering mirror object.
     * @param {import('./FastSteeringMirror.js').default|undefined} value - The FSM object.
     */
    set fsm(value) {
        this._fsm = value;
    }

    /**
     * Gets the payload objects.
     * @returns {Array<ElectroOpicalSensor|import('./Laser.js').default>} The payload objects.
     */
    get sensors() {
        return this._sensors;
    }

    /**
     * Sets the payload objects.
     * @param {ElectroOpicalSensor|import('./Laser.js').default|Array<ElectroOpicalSensor|import('./Laser.js').default>} value - The payload object(s).
     */
    set sensors(value) {
        const sensors = normalizeSensors(value);
        this._sensors = sensors;
        this._sensor = sensors[0];
    }

    /**
     * Gets the primary payload object.
     * @returns {SimObject} The primary payload object.
     */
    get sensor() {
        return this._sensor;
    }

    /**
     * Sets the primary payload object.
     * @param {ElectroOpicalSensor|import('./Laser.js').default} value - The payload object.
     */
    set sensor(value) {
        const sensors = Array.isArray(this._sensors) ? this._sensors.slice() : [];
        if (sensors.length === 0) {
            sensors.push(value);
        } else {
            sensors[0] = value;
        }
        this._sensors = sensors;
        this._sensor = sensors[0];
    }
}

export default Observatory;
