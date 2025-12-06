<script setup>
  import config from './config'
  import { getToken } from '@/utils/auth'
  import { useConfigStore } from '@/store'
  import StorageService from '@/utils/StorageService'
  import DatabaseService from '@/services/DatabaseService'
  import { getCurrentInstance } from "vue"
  import { onLaunch } from '@dcloudio/uni-app'

  const { proxy } = getCurrentInstance()

  onLaunch(() => {
    initApp()
  })

  // 初始化应用
  async function initApp() {
    // 初始化应用配置
    initConfig()

    // 初始化 SQLite 数据库
    await initDatabase()

    // 登录页面会自己检查服务器配置和Token状态
    // 这里只做最基本的初始化即可
  }

  function initConfig() {
    useConfigStore().setConfig(config)
  }

  // 初始化数据库
  async function initDatabase() {
    try {
      await DatabaseService.initDatabase()
      console.log('App启动：SQLite数据库初始化成功')
    } catch (error) {
      console.error('App启动：SQLite数据库初始化失败', error)
      // 数据库初始化失败不阻塞APP启动，继续使用Storage作为fallback
    }
  }

</script>

<style lang="scss">
  @import '@/static/scss/index.scss'
</style>
