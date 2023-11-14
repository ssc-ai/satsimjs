import ElectroOpicalSensor from "./ElectroOpticalSensor";
import Gimbal from "./Gimbal";
import SimObject from "./SimObject";


/**
 * Represents an observatory object.
 * @class
 */
class Observatory {

    /**
     * Creates an instance of Observatory.
     * @param {SimObject} site - The site object.
     * @param {Gimbal} gimbal - The gimbal object.
     * @param {ElectroOpicalSensor} sensor - The sensor object.
     */
    constructor(site, gimbal, sensor) {
        this._site = site;
        this._gimbal = gimbal;
        this._sensor = sensor;
    }

    /**
     * Gets the site object.
     * @returns {Site} The site object.
     */
    get site() {
        return this._site;
    }

    /**
     * Sets the site object.
     * @param {Site} value - The site object.
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
     * Gets the sensor object.
     * @returns {Sensor} The sensor object.
     */
    get sensor() {
        return this._sensor;
    }

    /**
     * Sets the sensor object.
     * @param {Sensor} value - The sensor object.
     */
    set sensor(value) {
        this._sensor = value;
    }
}

export default Observatory;