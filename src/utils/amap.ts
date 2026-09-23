import AMapLoader from '@amap/amap-jsapi-loader'

const AMAP_KEY = '4f0b8c0cd30fd313a46a6c2b211ef4f6'

let amapInstance: any = null

const loadAMap = async (): Promise<any> => {
  if (amapInstance) return
  amapInstance = await AMapLoader.load({
    key: AMAP_KEY,
    version: '2.0',
    // CitySearch 基于 IP 定位，不需要浏览器 GPS 权限
    plugins: ['AMap.CitySearch']
  })
  return amapInstance
}

export const currentArea = (): Record<string, any> => {
  let adcode: string = ''
  let cityName: string = ''
  let error: string = ''
  let loading: boolean = false
  const locate = async (): Promise<void> => {
    loading = true
    error = ''
    try {
      const AMap = await loadAMap()
      // CitySearch.getLocalCity 基于 IP 自动定位城市，
      // 不触发 navigator.geolocation 权限提示，不会被浏览器封禁
      const result = await new Promise<any>((resolve, reject) => {
        const cs = new AMap.CitySearch()
        cs.getLocalCity((status: string, res: any) => {
          if (status === 'complete' && res?.city) resolve(res)
          else reject(new Error(res?.message || '城市定位失败'))
        })
      })
      adcode = result.adcode || ''
      cityName = result.city || ''
    } catch (e: any) {
      error = e.message || '定位失败'
    } finally {
      loading = false
    }
  }
  return { adcode, cityName, loading, error, locate }
}

export const useWeather = (): Record<string, any> => {
  let weather: Record<string, string> = {}
  let loading: boolean = false
  let error: string = ''

  const getWeather = async (adcode: string) => {
    if (!adcode) {
      error = 'adcode 不能为空'
      return
    }

    loading = true
    error = ''
    try {
      const url = `https://restapi.amap.com/v3/weather/weatherInfo?key=${AMAP_KEY}&city=${adcode}&extensions=base`

      const response = await fetch(url)
      const data = await response.json()

      if (data.status === '1') {
        const live = data.lives[0]
        weather = {
          city: live.city,
          weather: live.weather,
          temperature: live.temperature,
          winddirection: live.winddirection,
          windpower: live.windpower,
          humidity: live.humidity,
          reporttime: live.reporttime
        }
      } else {
        error = data.info || '天气查询失败'
      }
    } catch (e: any) {
      error = e.message || '网络请求失败'
    } finally {
      loading = false
    }
  }

  return { weather, loading, error, getWeather }
}
