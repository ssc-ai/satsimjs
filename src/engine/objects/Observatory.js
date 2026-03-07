import ElectroOpicalSensor from "./ElectroOpticalSensor.js";
import Gimbal from "./Gimbal.js";
import SimObject from "./SimObject.js";

/**
 * Normalize observatory sensor input into an array while preserving the input
 * objects by reference.
 *
 * @param {ElectroOpicalSensor|ElectroOpicalSensor[]|undefined} input
 * @returns {Array<ElectroOpicalSensor|undefined>}
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
     * @param {ElectroOpicalSensor|ElectroOpicalSensor[]} sensor - The sensor object(s).
     */
    constructor(site, gimbal, sensor) {
        this._site = site;
        this._gimbal = gimbal;
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
     * Gets the sensor objects.
     * @returns {ElectroOpicalSensor[]} The sensor objects.
     */
    get sensors() {
        return this._sensors;
    }

    /**
     * Sets the sensor objects.
     * @param {ElectroOpicalSensor|ElectroOpicalSensor[]} value - The sensor object(s).
     */
    set sensors(value) {
        const sensors = normalizeSensors(value);
        this._sensors = sensors;
        this._sensor = sensors[0];
    }

    /**
     * Gets the primary sensor object.
     * @returns {SimObject} The primary sensor object.
     */
    get sensor() {
        return this._sensor;
    }

    /**
     * Sets the primary sensor object.
     * @param {ElectroOpicalSensor} value - The sensor object.
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
