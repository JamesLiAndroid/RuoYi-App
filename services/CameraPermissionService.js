/**
 * 相机权限服务类 - 检查和请求相机权限
 * 支持引导用户开启权限，处理各种权限状态
 */

class CameraPermissionService {
  /**
   * 检查相机权限状态
   * @returns {Object} 权限状态
   */
  async checkPermission() {
    return new Promise((resolve) => {
      //#ifdef APP-PLUS
      uni.getSetting({
        success: (res) => {
          const authorized = res.authSetting['scope.camera']
          resolve({
            isAuthorized: authorized === true,
            isDenied: authorized === false,
            isFirstRequest: authorized === undefined,
            status: authorized === true ? 'authorized'
                 : authorized === false ? 'denied'
                 : 'undetermined'
          })
        },
        fail: () => {
          resolve({
            isAuthorized: false,
            isDenied: false,
            isFirstRequest: true,
            status: 'undetermined'
          })
        }
      })
      //#endif

      //#ifdef H5
      // H5环境默认已授权（浏览器会自动请求）
      resolve({
        isAuthorized: true,
        isDenied: false,
        isFirstRequest: false,
        status: 'authorized'
      })
      //#endif
    })
  }

  /**
   * 请求相机权限（带引导）
   * @returns {Object} 请求结果
   */
  async requestPermission() {
    const status = await this.checkPermission()

    // 首次请求
    if (status.isFirstRequest) {
      return new Promise((resolve) => {
        //#ifdef APP-PLUS
        uni.authorize({
          scope: 'scope.camera',
          success: () => {
            resolve({
              success: true,
              type: 'FIRST_SUCCESS',
              message: '相机权限开启成功'
            })
          },
          fail: () => {
            resolve({
              success: false,
              type: 'FIRST_DENIED',
              message: '相机权限被拒绝',
              canRetry: true
            })
          }
        })
        //#endif

        //#ifdef H5
        resolve({
          success: true,
          type: 'FIRST_SUCCESS',
          message: 'H5环境默认授权'
        })
        //#endif
      })
    }

    // 之前被拒绝过
    if (status.isDenied) {
      //#ifdef APP-PLUS
      return new Promise((resolve) => {
        uni.showModal({
          title: '需要相机权限',
          content: '二维码扫描功能需要使用相机，请前往设置开启相机权限',
          confirmText: '去设置',
          cancelText: '取消',
          success: async (res) => {
            if (res.confirm) {
              try {
                await this.openSetting()
                resolve({
                  success: false,
                  type: 'SETTINGS_RETURNED',
                  message: '请在设置中开启相机权限',
                  canRetry: true
                })
              } catch (error) {
                resolve({
                  success: false,
                  type: 'SETTINGS_FAILED',
                  message: '无法打开设置页面',
                  canRetry: false
                })
              }
            } else {
              resolve({
                success: false,
                type: 'USER_CANCELLED',
                message: '用户取消',
                canRetry: false
              })
            }
          }
        })
      })
      //#endif

      //#ifdef H5
      return {
        success: false,
        type: 'H5_ENVIRONMENT',
        message: 'H5环境无需权限申请'
      }
      //#endif
    }

    // 已授权
    return {
      success: true,
      type: 'ALREADY_AUTHORIZED',
      message: '相机权限已开启'
    }
  }

  /**
   * 打开应用设置页面
   * @returns {Promise}
   */
  async openSetting() {
    return new Promise((resolve, reject) => {
      //#ifdef APP-PLUS
      uni.openSetting({
        success: () => {
          resolve()
        },
        fail: (error) => {
          // 尝试通过runtime.openURL打开（可能不生效）
          try {
            plus.runtime.openURL('app-settings:')
            resolve()
          } catch (e) {
            reject(error)
          }
        }
      })
      //#endif

      //#ifdef H5
      resolve()
      //#endif
    })
  }

  /**
   * 显示权限引导对话框
   * @param {Function} onConfirm - 确认回调
   * @param {Function} onCancel - 取消回调
   */
  showPermissionGuide(onConfirm, onCancel) {
    //#ifdef APP-PLUS
    uni.showModal({
      title: '相机权限说明',
      content: '为了使用二维码扫描功能，需要开启相机权限。\n\n开启后可扫描巡检点位码，完成巡检任务。',
      confirmText: '去开启',
      cancelText: '稍后再说',
      success: (res) => {
        if (res.confirm) {
          if (onConfirm) onConfirm()
        } else {
          if (onCancel) onCancel()
        }
      }
    })
    //#endif

    //#ifdef H5
    if (onConfirm) onConfirm()
    //#endif
  }

  /**
   * 显示权限被拒绝提示
   * @param {Function} onRetry - 重试回调
   * @param {Function} onManualInput - 手动输入回调
   */
  showPermissionDenied(onRetry, onManualInput) {
    //#ifdef APP-PLUS
    uni.showModal({
      title: '相机权限被拒绝',
      content: '无法使用相机扫描二维码。您可以：\n\n1. 前往设置开启相机权限\n2. 使用手动输入点位码',
      showCancel: true,
      confirmText: '去设置',
      cancelText: '手动输入',
      success: (res) => {
        if (res.confirm) {
          this.openSetting().then(() => {
            if (onRetry) onRetry()
          })
        } else {
          if (onManualInput) onManualInput()
        }
      }
    })
    //#endif

    //#ifdef H5
    if (onManualInput) onManualInput()
    //#endif
  }

  /**
   * 获取权限状态文本
   * @param {string} status - 权限状态
   * @returns {string} 状态文本
   */
  getStatusText(status) {
    const statusTexts = {
      'authorized': '相机权限已开启',
      'denied': '相机权限被拒绝',
      'undetermined': '相机权限未确定',
      'unknown': '权限状态未知'
    }

    return statusTexts[status] || statusTexts['unknown']
  }

  /**
   * 检查设备是否支持相机
   * @returns {boolean} 是否支持
   */
  isCameraSupported() {
    //#ifdef APP-PLUS
    try {
      const context = plus.android.runtimeMainActivity()
      const packageManager = context.getPackageManager()

      // 检查相机功能
      const hasCamera = packageManager.hasSystemFeature('android.hardware.camera')
      const hasFrontCamera = packageManager.hasSystemFeature('android.hardware.camera.front')

      return hasCamera
    } catch (error) {
      console.error('检查相机支持失败:', error)
      return true // 默认返回true，避免误判
    }
    //#endif

    //#ifdef H5
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
    //#endif
  }

  /**
   * 获取相机信息
   * @returns {Object} 相机信息
   */
  getCameraInfo() {
    //#ifdef APP-PLUS
    try {
      const context = plus.android.runtimeMainActivity()
      const packageManager = context.getPackageManager()

      const hasCamera = packageManager.hasSystemFeature('android.hardware.camera')
      const hasFrontCamera = packageManager.hasSystemFeature('android.hardware.camera.front')
      const hasBackCamera = packageManager.hasSystemFeature('android.hardware.camera.back')

      return {
        hasCamera,
        hasFrontCamera,
        hasBackCamera,
        supported: hasCamera
      }
    } catch (error) {
      console.error('获取相机信息失败:', error)
      return {
        hasCamera: true,
        hasFrontCamera: true,
        hasBackCamera: true,
        supported: true
      }
    }
    //#endif

    //#ifdef H5
    return {
      hasCamera: true,
      hasFrontCamera: false,
      hasBackCamera: true,
      supported: true
    }
    //#endif
  }
}

// 单例模式
const cameraPermissionService = new CameraPermissionService()
export default cameraPermissionService
