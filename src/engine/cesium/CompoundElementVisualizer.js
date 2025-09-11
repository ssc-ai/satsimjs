import { Color } from "cesium"

class CompountElementVisualizer {
  constructor(color, materialAlpha, outlineAlpha) {
    this._entities = []
    this._show = true
    this._outline = true
    this._color = color ?? Color.WHITE
    this._materialAlpha = materialAlpha ?? 0.25
    this._outlineAlpha = outlineAlpha ?? 0.5
  }

  get show() {
    return this._show
  }

  set show(value) {
    this._show = value
    this._entities.forEach(entity => {
      entity.show = value
    })
  }

  get outline() {
    return this._outline
  }

  set outline(value) {
    this._entities.forEach(entity => {
      entity.outline = value
    })
  }

  get color() {
    return this._color
  }

  set color(value) {
    this._color = value
    this._entities.forEach(entity => {
      entity.material = this._color.withAlpha(this._materialAlpha)
      entity.outlineColor = this._color.withAlpha(this._outlineAlpha)
    })
  }
  
}

export default CompountElementVisualizer
