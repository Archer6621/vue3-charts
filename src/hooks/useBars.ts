import { Ref, ref, watch } from 'vue'
import { Data, LayerProps, LayerType, Rectangle } from '@/types'
import useChart from './useChart'
import { Series } from 'd3-shape'

export interface BarsOptions extends LayerProps {
  gap?: number
  type?: LayerType
}

export interface BarsReturn {
  bars: Ref<Rectangle[]>
}

export default (dataKeys: [string, string], options: BarsOptions = {}): BarsReturn => {
  const bars = ref<Rectangle[]>([])
  const chart = useChart()
  const { stacked = false, type = 'bar', gap = 5, maxWidth = -1 } = options
  let yAcc = 0;

  function scales() {
    const { primary, secondary } = chart.scales
    const bandScale = primary.type === 'band' ? primary : secondary
    const linearScale = primary.type === 'band' ? secondary : primary

    return { bandScale, linearScale }
  }

  function getIndex() {
    const barLayers = chart.getLayers(type)
    const idx = barLayers.findIndex((l) => l.dataKeys.join(',') === dataKeys.join(','))

    return idx > -1 ? idx : 0
  }

  function getBarWidth() {
    const { bandScale } = scales()
    const available = bandScale.bandwidth() - gap
    const width = maxWidth > -1 ? Math.min(available, maxWidth) : available
    const barLayers = chart.getLayers(type)

    return barLayers.length > 0 ? width / barLayers.length : width
  }

  function getDiffWidth() {
    const { bandScale } = scales()
    const max = bandScale.bandwidth() - gap
    const total = chart.getLayers(type).length * getBarWidth()
    return (max - total) / 2
  }

  function getBars(key: string, values: Series<Data, string>) {
    const { bandScale, linearScale } = scales()
    let index = getIndex()
    const barSize = getBarWidth()
    const diff = getDiffWidth()
    const barLayers = chart.getLayers(type)
    const stacked = barLayers[index]?.props?.stacked ?? false
    const nextStacked = barLayers[index+1]?.props?.stacked ?? false
    const prevBarKey = barLayers[index-1]?.dataKeys[1];
    
    let wMultiplier = 1;
    if (stacked) {index-=1;}
    if (stacked || nextStacked) {
        wMultiplier = 2;
    }

    return values.map((val) => {
      const rect: Rectangle = { x: 0, y: 0, width: 0, height: 0, props: { values: [...val], data: val.data } }
      const xVal = bandScale.at(val.data[key])
      const [yVal0, yVal1] = linearScale.map([...val])
      const [pyv0, pyv1] = linearScale.map([0, val.data?.[prevBarKey] ?? 0]);
      if (chart.config.direction === 'horizontal') {
        
        rect.y =  Math.min(yVal0, yVal1) - (stacked ? Math.abs(pyv0 - pyv1)- 1 : 0) 
        rect.height = Math.abs(yVal0 - yVal1)
        // console.log(stacked ? "stacked":"!stacked",yAcc, rect.height)
        // if (!stacked) {
        //   yAcc -= Math.abs(yVal0 - yVal1);
        //   console.log("setting to", Math.abs(yVal0 - yVal1))
        // } else {
        //   yAcc = 0;
        // }
        rect.x = diff + xVal + index  * barSize + gap / 2
        rect.width = barSize * wMultiplier
      } else if (chart.config.direction === 'vertical') {
        rect.x = Math.min(yVal0, yVal1)
        rect.width = Math.abs(yVal0 - yVal1)

        rect.y = diff + xVal + index * barSize + gap / 2
        rect.height = barSize
      }
      return rect
    })
  }

  function update() {
    const keys = stacked ? chart.getStackedKeys(1, type) : [dataKeys[1]]
    const [primaryKey, secondaryKey] = dataKeys
    const stack = chart.getStackedData(keys)
    const data = stack.find((s) => s.key === secondaryKey)
    const pkval = stack.find((s) => s.key === primaryKey)
    // console.log("pkval", pkval, dataKeys[0], chart.getData([primaryKey]), primaryKey, data);
    if (data) {
      bars.value = getBars(primaryKey, data)
    }
  }

  watch(chart.updates, update)

  return {
    bars
  }
}
