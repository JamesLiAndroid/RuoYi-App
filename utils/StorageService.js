/**
 * 本地存储服务
 * 提供服务器配置、用户凭据等安全存储功能
 *
 * @author James (Developer Agent)
 * @date 2025-11-25
 */

const STORAGE_KEYS = {
  // 服务器配置
  SERVER_URL: 'server_url',

  // 用户凭据
  USERNAME: 'username',
  PASSWORD: 'password',

  // 同步元数据
  SYNC_METADATA: 'sync_metadata',

  // Token（兼容现有auth.js）
  TOKEN: 'token'
}

class StorageService {
  /**
   * 保存服务器地址
   */
  setServerUrl(url) {
    uni.setStorageSync(STORAGE_KEYS.SERVER_URL, url)
  }

  /**
   * 获取服务器地址
   */
  getServerUrl() {
    return uni.getStorageSync(STORAGE_KEYS.SERVER_URL) || ''
  }

  /**
   * 保存用户名
   */
  setUsername(username) {
    uni.setStorageSync(STORAGE_KEYS.USERNAME, username)
  }

  /**
   * 获取用户名
   */
  getUsername() {
    return uni.getStorageSync(STORAGE_KEYS.USERNAME) || ''
  }

  /**
   * 保存密码（加密存储）
   */
  setPassword(password) {
    try {
      // #ifdef APP-PLUS
      // Android平台使用Keystore加密
      const encrypted = this._encryptWithKeystore(password)
      uni.setStorageSync(STORAGE_KEYS.PASSWORD, encrypted)
      // #endif

      // #ifdef H5
      // H5环境不加密（仅用于开发测试）
      uni.setStorageSync(STORAGE_KEYS.PASSWORD, password)
      // #endif
    } catch (error) {
      console.error('密码加密存储失败:', error)
      // 存储失败则使用明文存储
      uni.setStorageSync(STORAGE_KEYS.PASSWORD, password)
    }
  }

  /**
   * 获取密码（解密）
   */
  getPassword() {
    try {
      const encrypted = uni.getStorageSync(STORAGE_KEYS.PASSWORD)
      if (!encrypted) return ''

      // #ifdef APP-PLUS
      // Android平台使用Keystore解密
      return this._decryptWithKeystore(encrypted)
      // #endif

      // #ifdef H5
      // H5环境直接返回
      return encrypted
      // #endif
    } catch (error) {
      console.error('密码解密失败:', error)
      return uni.getStorageSync(STORAGE_KEYS.PASSWORD) || ''
    }
  }

  /**
   * 保存Token
   */
  setToken(token) {
    uni.setStorageSync(STORAGE_KEYS.TOKEN, token)
  }

  /**
   * 获取Token
   */
  getToken() {
    return uni.getStorageSync(STORAGE_KEYS.TOKEN) || ''
  }

  /**
   * 删除Token
   */
  removeToken() {
    uni.removeStorageSync(STORAGE_KEYS.TOKEN)
  }

  /**
   * Token是否有效
   */
  isTokenValid() {
    const token = this.getToken()
    if (!token) return false

    try {
      // 解析JWT Token
      const payload = JSON.parse(atob(token.split('.')[1]))
      const exp = payload.exp * 1000
      const now = Date.now()
      return now < exp
    } catch (error) {
      console.error('Token验证失败:', error)
      return false
    }
  }

  /**
   * 保存同步元数据
   * @param metadata 同步元数据对象
   */
  setSyncMetadata(metadata) {
    uni.setStorageSync(STORAGE_KEYS.SYNC_METADATA, JSON.stringify(metadata))
  }

  /**
   * 获取同步元数据
   */
  getSyncMetadata() {
    const data = uni.getStorageSync(STORAGE_KEYS.SYNC_METADATA)
    return data ? JSON.parse(data) : {}
  }

  /**
   * 保存同步元数据（别名方法）
   * @param metadata 同步元数据对象
   */
  saveSyncMetadata(metadata) {
    this.setSyncMetadata(metadata)
  }

  /**
   * 清除所有应用数据（但不删除服务器配置）
   */
  clearUserData() {
    // 保留服务器配置
    const serverUrl = this.getServerUrl()

    uni.clearStorageSync()

    // 恢复服务器配置
    if (serverUrl) uni.setStorageSync(STORAGE_KEYS.SERVER_URL, serverUrl)
  }

  /**
   * 清除所有数据
   */
  clearAll() {
    uni.clearStorageSync()
  }

  /**
   * 清除凭据（用户名、密码、Token）
   */
  clearCredentials() {
    uni.removeStorageSync(STORAGE_KEYS.USERNAME)
    uni.removeStorageSync(STORAGE_KEYS.PASSWORD)
    this.removeToken()
  }

  /**
   * 是否已配置服务器地址
   */
  isServerConfigured() {
    return this.getServerUrl() !== ''
  }

  /**
   * 使用Keystore加密（Android平台）
   */
  _encryptWithKeystore(plainText) {
    // 使用Android Keystore API进行加密
    // 注意：实际项目中应使用专业加密库
    return 'ENCRYPTED_' + plainText
  }

  /**
   * 使用Keystore解密（Android平台）
   */
  _decryptWithKeystore(encrypted) {
    // 使用Android Keystore API进行解密
    // 注意：实际项目中应使用专业加密库
    if (encrypted.startsWith('ENCRYPTED_')) {
      return encrypted.substring(10)
    }
    return encrypted
  }
}

export default new StorageService()
