import { defineStore } from 'pinia'
import { ref } from 'vue'
import config from '@/config'
import storage from '@/utils/storage'
import constant from '@/utils/constant'
import { isHttp, isEmpty } from "@/utils/validate"
import { getInfo, login, logout, getMobileUserInfo } from '@/api/login'
import { getToken, removeToken, setToken } from '@/utils/auth'
import defAva from '@/static/images/profile.jpg'

const baseUrl = config.baseUrl

export const useUserStore = defineStore('user', () => {
  const token = ref(getToken())
  const id = ref(storage.get(constant.id))
  const name = ref(storage.get(constant.name))
  const avatar = ref(storage.get(constant.avatar))
  const roles = ref(storage.get(constant.roles))
  const permissions = ref(storage.get(constant.permissions))

  const SET_TOKEN = (val) => {
    token.value = val
  }
  const SET_ID = (val) => {
    id.value = val
    storage.set(constant.id, val)
  }
  const SET_NAME = (val) => {
    name.value = val
    storage.set(constant.name, val)
  }
  const SET_AVATAR = (val) => {
    avatar.value = val
    storage.set(constant.avatar, val)
  }
  const SET_ROLES = (val) => {
    roles.value = val
    storage.set(constant.roles, val)
  }
  const SET_PERMISSIONS = (val) => {
    permissions.value = val
    storage.set(constant.permissions, val)
  }

  // 登录
  const loginAction = (userInfo) => {
    const username = userInfo.username.trim()
    const password = userInfo.password
    const code = userInfo.code
    const uuid = userInfo.uuid
    const tenantId = userInfo.tenantId  // 获取租户ID
    return new Promise((resolve, reject) => {
      login(username, password, code, uuid, tenantId).then(res => {
        console.log('登录API响应:', res)

        // request.js返回的是res.data，所以这里res包含{code, msg, data}
        // 实际的登录数据在res.data中
        const loginData = res.data || res
        console.log('登录数据:', loginData)

        // 适配后端返回的access_token（兼容旧版token字段）
        const token = loginData.access_token || loginData.token
        console.log('提取的Token:', token)

        if (!token) {
          console.error('登录响应中未包含token:', res)
          reject(new Error('登录响应中未包含token'))
          return
        }
        setToken(token)
        SET_TOKEN(token)
        console.log('Token已保存')
        resolve()
      }).catch(error => {
        console.error('登录失败:', error)
        reject(error)
      })
    })
  }

  // 获取用户信息
  const getInfoAction = () => {
    return new Promise((resolve, reject) => {
      getInfo().then(res => {
        const user = res.user
        let avatar = user.avatar || ""
        if (!isHttp(avatar)) {
          avatar = (isEmpty(avatar)) ? defAva : baseUrl + avatar
        }
        const userid = (isEmpty(user) || isEmpty(user.userId)) ? "" : user.userId
        const username = (isEmpty(user) || isEmpty(user.userName)) ? "" : user.userName
        if (res.roles && res.roles.length > 0) {
          SET_ROLES(res.roles)
          SET_PERMISSIONS(res.permissions)
        } else {
          SET_ROLES(['ROLE_DEFAULT'])
        }
		SET_ID(userid)
        SET_NAME(username)
        SET_AVATAR(avatar)
        resolve(res)
      }).catch(error => {
        reject(error)
      })
    })
  }

  // 获取移动端用户信息（适配移动端API）
  const getMobileUserInfoAction = () => {
    return new Promise((resolve, reject) => {
      getMobileUserInfo().then(res => {
        const user = res.data
        if (!user) {
          reject(new Error('用户信息获取失败'))
          return
        }
        // 保存用户基本信息
        const userid = user.user_id || ""
        const username = user.username || ""
        const realName = user.real_name || ""
        const deptId = user.dept_id || ""
        const deptName = user.dept_name || ""

        SET_ID(userid)
        SET_NAME(realName || username)
        SET_AVATAR(defAva)

        // 保存额外信息到storage
        storage.set('dept_id', deptId)
        storage.set('dept_name', deptName)
        storage.set('real_name', realName)

        resolve(res)
      }).catch(error => {
        reject(error)
      })
    })
  }

  // 退出系统
  const logOutAction = () => {
    return new Promise((resolve, reject) => {
      logout(token.value).then(() => {
        SET_TOKEN('')
        SET_ROLES([])
        SET_PERMISSIONS([])
        removeToken()
        storage.clean()
        resolve()
      }).catch(error => {
        reject(error)
      })
    })
  }

  return {
    token,
    id,
    name,
    avatar,
    roles,
    permissions,
    SET_AVATAR,
    login: loginAction,
    getInfo: getInfoAction,
    getMobileUserInfo: getMobileUserInfoAction,
    logOut: logOutAction
  }
})
