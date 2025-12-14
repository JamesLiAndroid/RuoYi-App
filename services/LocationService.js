/**
 * 位置服务 - 获取GPS坐标，支持离线模式
 * 可选的巡检位置验证功能
 */

class LocationService {
  constructor() {
    this.watchId = null
    this.currentLocation = null
  }

  /**
   * 获取当前位置（一次性）
   * @param {Object} options - 获取选项
   * @returns {Promise<Object>} 位置信息
   */
  async getCurrentLocation(options = {}) {
    const {
      timeout = 10000, // 超时时间（毫秒）
      enableHighAccuracy = true, // 是否高精度
      maximumAge = 0, // 缓存时间
      showToast = true // 是否显示提示
    } = options

    return new Promise((resolve, reject) => {
      //#ifdef APP-PLUS
      plus.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            longitude: position.coords.longitude,
            latitude: position.coords.latitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude || null,
            speed: position.coords.speed || null,
            heading: position.coords.heading || null,
            timestamp: position.timestamp
          }

          this.currentLocation = location

          if (showToast) {
            uni.showToast({
              title: `定位成功: ${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`,
              icon: 'none',
              duration: 2000
            })
          }

          resolve(location)
        },
        (error) => {
          console.error('获取位置失败:', error)

          let message = '定位失败'
          switch (error.code) {
            case error.TIMEOUT:
              message = '定位超时，请重试'
              break
            case error.PERMISSION_DENIED:
              message = '定位权限被拒绝'
              break
            case error.POSITION_UNAVAILABLE:
              message = '位置信息不可用'
              break
            default:
              message = error.message || '未知定位错误'
          }

          if (showToast) {
            uni.showModal({
              title: '定位失败',
              content: message + '\n\n是否前往设置页面开启定位权限？',
              confirmText: '去设置',
              success: (res) => {
                if (res.confirm) {
                  plus.runtime.openURL('app-settings:')
                }
              }
            })
          }

          reject(new Error(message))
        },
        {
          enableHighAccuracy,
          timeout,
          maximumAge
        }
      )
      //#endif

      //#ifdef H5
      // H5环境模拟定位
      setTimeout(() => {
        const mockLocation = {
          longitude: 116.407526, // 北京天安门坐标
          latitude: 39.90403,
          accuracy: 10,
          altitude: 50,
          speed: 0,
          heading: 0,
          timestamp: Date.now()
        }

        this.currentLocation = mockLocation

        if (showToast) {
          uni.showToast({
            title: `H5模拟定位成功`,
            icon: 'none',
            duration: 2000
          })
        }

        resolve(mockLocation)
      }, 1000)
      //#endif
    })
  }

  /**
   * 开始持续定位（监听位置变化）
   * @param {Function} callback - 位置变化回调
   * @param {Object} options - 获取选项
   * @returns {number} 监听器ID
   */
  startLocationWatch(callback, options = {}) {
    //#ifdef APP-PLUS
    this.watchId = plus.geolocation.watchPosition(
      (position) => {
        const location = {
          longitude: position.coords.longitude,
          latitude: position.coords.latitude,
          accuracy: position.coords.accuracy,
          altitude: position.coords.altitude || null,
          speed: position.coords.speed || null,
          heading: position.coords.heading || null,
          timestamp: position.timestamp
        }

        this.currentLocation = location

        if (callback) {
          callback(location)
        }
      },
      (error) => {
        console.error('监听位置变化失败:', error)
      },
      options
    )
    //#endif

    //#ifdef H5
    // H5环境模拟
    if (typeof window !== 'undefined' && window.navigator.geolocation) {
      this.watchId = window.navigator.geolocation.watchPosition(
        (position) => {
          const location = {
            longitude: position.coords.longitude,
            latitude: position.coords.latitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude || null,
            speed: position.coords.speed || null,
            heading: position.coords.heading || null,
            timestamp: position.timestamp
          }

          this.currentLocation = location

          if (callback) {
            callback(location)
          }
        },
        (error) => {
          console.error('H5监听位置失败:', error)
        },
        options
      )
    }
    //#endif

    return this.watchId
  }

  /**
   * 停止持续定位
   */
  stopLocationWatch() {
    //#ifdef APP-PLUS
    if (this.watchId !== null) {
      plus.geolocation.clearWatch(this.watchId)
      this.watchId = null
    }
    //#endif

    //#ifdef H5
    if (typeof window !== 'undefined' && window.navigator.geolocation && this.watchId !== null) {
      window.navigator.geolocation.clearWatch(this.watchId)
      this.watchId = null
    }
    //#endif
  }

  /**
   * 计算两点间距离（米）
   * @param {number} lat1 - 纬度1
   * @param {number} lon1 - 经度1
   * @param {number} lat2 - 纬度2
   * @param {number} lon2 - 经度2
   * @returns {number} 距离（米）
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000 // 地球半径（米）
    const dLat = this.toRadians(lat2 - lat1)
    const dLon = this.toRadians(lon2 - lon1)

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2)

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
  }

  /**
   * 角度转弧度
   */
  toRadians(degrees) {
    return degrees * (Math.PI / 180)
  }

  /**
   * 验证位置是否在允许范围内
   * @param {Object} currentLocation - 当前位置
   * @param {Object} expectedLocation - 期望位置
   * @param {number} toleranceMeters - 允许偏差（米）
   * @returns {Object} 验证结果
   */
  validateLocation(currentLocation, expectedLocation, toleranceMeters = 50) {
    if (!currentLocation || !expectedLocation) {
      return {
        isValid: false,
        error: '位置信息不完整'
      }
    }

    const distance = this.calculateDistance(
      currentLocation.latitude,
      currentLocation.longitude,
      expectedLocation.latitude,
      expectedLocation.longitude
    )

    const isValid = distance <= toleranceMeters

    return {
      isValid,
      distance,
      toleranceMeters,
      message: isValid
        ? `位置验证通过，距离偏差 ${Math.round(distance)} 米`
        : `位置偏差过大，距离偏差 ${Math.round(distance)} 米（允许范围 ${toleranceMeters} 米）`
    }
  }

  /**
   * 获取上次保存的位置
   * @returns {Object} 位置信息
   */
  getLastLocation() {
    return this.currentLocation
  }

  /**
   * 保存位置到本地
   * @param {Object} location - 位置信息
   */
  saveLocation(location) {
    //#ifdef APP-PLUS
    try {
      uni.setStorageSync('last_inspection_location', location)
    } catch (error) {
      console.error('保存位置失败:', error)
    }
    //#endif

    //#ifdef H5
    try {
      localStorage.setItem('last_inspection_location', JSON.stringify(location))
    } catch (error) {
      console.error('H5保存位置失败:', error)
    }
    //#endif
  }

  /**
   * 从本地加载位置
   * @returns {Object} 位置信息
   */
  loadLocation() {
    //#ifdef APP-PLUS
    try {
      const location = uni.getStorageSync('last_inspection_location')
      return location || null
    } catch (error) {
      console.error('加载位置失败:', error)
      return null
    }
    //#endif

    //#ifdef H5
    try {
      const locationStr = localStorage.getItem('last_inspection_location')
      return locationStr ? JSON.parse(locationStr) : null
    } catch (error) {
      console.error('H5加载位置失败:', error)
      return null
    }
    //#endif
  }
}

// 单例模式
const locationService = new LocationService()
export default locationService
