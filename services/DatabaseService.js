/**
 * SQLite 数据库服务
 * 功能：封装 SQLite 数据库操作，支持表创建、数据CRUD、事务管理
 * 环境支持：APP（plus.sqlite）、H5（WebSQL fallback）
 *
 * @author James (Developer Agent)
 * @date 2025-12-06
 */

class DatabaseService {
  constructor() {
    this.dbName = 'inspection.db'
    this.dbPath = '_doc/inspection.db'
    this.isInitialized = false
    this.db = null
  }

  /**
   * 初始化数据库
   * @returns {Promise<void>}
   */
  async initDatabase() {
    if (this.isInitialized) {
      return
    }

    try {
      // #ifdef APP-PLUS
      await this.initAppDatabase()
      // #endif

      // #ifdef H5
      await this.initH5Database()
      // #endif

      // 创建表结构
      await this.createTables()

      this.isInitialized = true
    } catch (error) {
      console.error('数据库初始化失败:', error)
      throw error
    }
  }

  /**
   * 初始化APP环境数据库（plus.sqlite）
   */
  async initAppDatabase() {
    return new Promise((resolve, reject) => {
      // #ifdef APP-PLUS
      plus.sqlite.openDatabase({
        name: this.dbName,
        path: this.dbPath,
        success: (e) => {
          this.db = this.dbName
          resolve()
        },
        fail: (e) => {
          console.error('APP数据库打开失败:', e)
          reject(new Error('数据库打开失败'))
        }
      })
      // #endif

      // #ifndef APP-PLUS
      // 非APP环境，直接resolve（H5会走另一个分支）
      resolve()
      // #endif
    })
  }

  /**
   * 初始化H5环境数据库（WebSQL）
   */
  async initH5Database() {
    return new Promise((resolve, reject) => {
      // #ifdef H5
      if (window.openDatabase) {
        try {
          this.db = window.openDatabase(this.dbName, '1.0', 'Inspection Database', 10 * 1024 * 1024)
          resolve()
        } catch (error) {
          console.error('H5数据库打开失败:', error)
          reject(error)
        }
      } else {
        console.warn('浏览器不支持WebSQL，数据将保存到Storage')
        resolve()
      }
      // #endif

      // #ifndef H5
      resolve()
      // #endif
    })
  }

  /**
   * 创建所有表
   */
  async createTables() {
    const tables = [
      this.getRouteTableSQL(),
      this.getPointTableSQL(),
      this.getItemTableSQL(),
      this.getTaskTableSQL(),
      this.getSyncMetadataTableSQL()
    ]

    for (const sql of tables) {
      await this.executeSql(sql)
    }
  }

  /**
   * 巡检路线表SQL
   */
  getRouteTableSQL() {
    return `
      CREATE TABLE IF NOT EXISTS inspection_route (
        route_id INTEGER PRIMARY KEY,
        route_name TEXT,
        route_code TEXT,
        dept_id INTEGER,
        cycle_id INTEGER,
        period_id INTEGER,
        is_enabled INTEGER,
        points_json TEXT,
        sync_time TEXT,
        version INTEGER
      )
    `
  }

  /**
   * 巡检点位表SQL
   */
  getPointTableSQL() {
    return `
      CREATE TABLE IF NOT EXISTS inspection_point (
        point_id INTEGER PRIMARY KEY,
        point_code TEXT,
        point_name TEXT,
        location TEXT,
        dept_id INTEGER,
        card_id TEXT,
        device_type TEXT,
        sync_time TEXT,
        version INTEGER
      )
    `
  }

  /**
   * 巡查项目表SQL
   */
  getItemTableSQL() {
    return `
      CREATE TABLE IF NOT EXISTS inspection_item (
        item_id INTEGER PRIMARY KEY,
        point_id INTEGER,
        item_name TEXT,
        item_type TEXT,
        order_num INTEGER,
        default_value TEXT,
        options TEXT,
        min_value REAL,
        max_value REAL,
        unit TEXT,
        description TEXT,
        sync_time TEXT,
        version INTEGER
      )
    `
  }

  /**
   * 巡检任务表SQL
   */
  getTaskTableSQL() {
    return `
      CREATE TABLE IF NOT EXISTS inspection_task (
        task_id INTEGER PRIMARY KEY,
        task_code TEXT,
        route_id INTEGER,
        inspector_id INTEGER,
        status TEXT,
        planned_start_time TEXT,
        planned_end_time TEXT,
        actual_start_time TEXT,
        actual_end_time TEXT,
        sync_time TEXT,
        version INTEGER
      )
    `
  }

  /**
   * 同步元数据表SQL
   */
  getSyncMetadataTableSQL() {
    return `
      CREATE TABLE IF NOT EXISTS sync_metadata (
        table_name TEXT PRIMARY KEY,
        version TEXT,
        last_sync_time TEXT
      )
    `
  }

  /**
   * 保存路线数据（批量）
   * @param {Array} routes 路线数据数组
   */
  async saveRoutes(routes) {
    // 清空旧数据
    await this.executeSql('DELETE FROM inspection_route')

    // 批量插入新数据
    for (const route of routes) {
      const sql = `
        INSERT INTO inspection_route (
          route_id, route_name, route_code, dept_id, cycle_id, period_id,
          is_enabled, points_json, sync_time, version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
      const params = [
        route.routeId,
        route.routeName,
        route.routeCode,
        route.deptId,
        route.cycleId,
        route.periodId,
        route.isEnabled,
        JSON.stringify(route.points || []),
        new Date().toISOString(),
        1
      ]

      await this.executeSql(sql, params)
    }
  }

  /**
   * 保存点位数据（批量）
   * @param {Array} points 点位数据数组
   */
  async savePoints(points) {
    await this.executeSql('DELETE FROM inspection_point')

    for (const point of points) {
      const sql = `
        INSERT INTO inspection_point (
          point_id, point_code, point_name, location, dept_id,
          card_id, device_type, sync_time, version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
      const params = [
        point.pointId,
        point.pointCode,
        point.pointName,
        point.location,
        point.deptId,
        point.cardId,
        point.deviceType,
        new Date().toISOString(),
        1
      ]

      await this.executeSql(sql, params)
    }
  }

  /**
   * 保存巡查项目数据（批量）
   * @param {Array} items 巡查项目数据数组
   */
  async saveInspectionItems(items) {
    await this.executeSql('DELETE FROM inspection_item')

    for (const item of items) {
      const sql = `
        INSERT INTO inspection_item (
          item_id, point_id, item_name, item_type, order_num,
          default_value, options, min_value, max_value, unit,
          description, sync_time, version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
      const params = [
        item.itemId,
        item.pointId,
        item.itemName,
        item.itemType,
        item.orderNum,
        item.defaultValue,
        JSON.stringify(item.options || []),
        item.minValue,
        item.maxValue,
        item.unit,
        item.description,
        new Date().toISOString(),
        1
      ]

      await this.executeSql(sql, params)
    }
  }

  /**
   * 保存任务数据（批量）
   * @param {Array} tasks 任务数据数组
   */
  async saveTasks(tasks) {
    await this.executeSql('DELETE FROM inspection_task')

    for (const task of tasks) {
      const sql = `
        INSERT INTO inspection_task (
          task_id, task_code, route_id, inspector_id, status,
          planned_start_time, planned_end_time, actual_start_time,
          actual_end_time, sync_time, version
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
      const params = [
        task.taskId,
        task.taskCode,
        task.routeId,
        task.inspectorId,
        task.status,
        task.plannedStartTime,
        task.plannedEndTime,
        task.actualStartTime,
        task.actualEndTime,
        new Date().toISOString(),
        1
      ]

      await this.executeSql(sql, params)
    }
  }

  /**
   * 查询路线列表
   */
  async queryRoutes() {
    const sql = 'SELECT * FROM inspection_route WHERE is_enabled = 1 ORDER BY route_code'
    return await this.query(sql)
  }

  /**
   * 查询点位列表
   * @param {number} routeId 路线ID（可选）
   */
  async queryPoints(routeId = null) {
    let sql = 'SELECT * FROM inspection_point'
    const params = []

    if (routeId) {
      sql += ' WHERE point_id IN (SELECT point_id FROM inspection_route WHERE route_id = ?)'
      params.push(routeId)
    }

    return await this.query(sql, params)
  }

  /**
   * 更新同步元数据
   * @param {string} tableName 表名
   * @param {string} version 版本号
   * @returns {Promise<void>}
   */
  async updateSyncMetadata(tableName, version) {
    // SQLite 使用 INSERT OR REPLACE 实现 UPSERT
    const sql = `
      INSERT OR REPLACE INTO sync_metadata (table_name, version, last_sync_time)
      VALUES (?, ?, ?)
    `
    const params = [tableName, version, new Date().toISOString()]
    await this.executeSql(sql, params)
  }

  /**
   * 获取同步元数据
   * @param {string} tableName 表名
   * @returns {Promise<Object|null>}
   */
  async getSyncMetadata(tableName) {
    const sql = 'SELECT * FROM sync_metadata WHERE table_name = ?'
    const results = await this.query(sql, [tableName])
    return results.length > 0 ? results[0] : null
  }

  /**
   * 执行SQL语句
   * @param {string} sql SQL语句
   * @param {Array} params 参数
   * @returns {Promise<any>}
   */
  async executeSql(sql, params = []) {
    // #ifdef APP-PLUS
    return this.executeAppSql(sql, params)
    // #endif

    // #ifdef H5
    return this.executeH5Sql(sql, params)
    // #endif

    // #ifndef APP-PLUS || H5
    throw new Error('不支持的平台')
    // #endif
  }

  /**
   * APP环境执行SQL
   */
  async executeAppSql(sql, params = []) {
    return new Promise((resolve, reject) => {
      // #ifdef APP-PLUS
      plus.sqlite.executeSql({
        name: this.dbName,
        sql: sql,
        success: (e) => {
          resolve(e)
        },
        fail: (e) => {
          console.error('SQL执行失败:', sql, e)
          reject(e)
        }
      })
      // #endif

      // #ifndef APP-PLUS
      reject(new Error('非APP环境'))
      // #endif
    })
  }

  /**
   * H5环境执行SQL（WebSQL）
   */
  async executeH5Sql(sql, params = []) {
    return new Promise((resolve, reject) => {
      // #ifdef H5
      if (!this.db) {
        reject(new Error('数据库未初始化'))
        return
      }

      this.db.transaction((tx) => {
        tx.executeSql(
          sql,
          params,
          (tx, results) => {
            resolve(results)
          },
          (tx, error) => {
            console.error('SQL执行失败:', sql, error)
            reject(error)
          }
        )
      })
      // #endif

      // #ifndef H5
      reject(new Error('非H5环境'))
      // #endif
    })
  }

  /**
   * 查询数据
   * @param {string} sql SQL查询语句
   * @param {Array} params 参数
   * @returns {Promise<Array>}
   */
  async query(sql, params = []) {
    // #ifdef APP-PLUS
    return this.queryApp(sql, params)
    // #endif

    // #ifdef H5
    return this.queryH5(sql, params)
    // #endif

    // #ifndef APP-PLUS || H5
    return []
    // #endif
  }

  /**
   * APP环境查询
   */
  async queryApp(sql, params = []) {
    return new Promise((resolve, reject) => {
      // #ifdef APP-PLUS
      plus.sqlite.selectSql({
        name: this.dbName,
        sql: sql,
        success: (data) => {
          resolve(data)
        },
        fail: (e) => {
          console.error('查询失败:', sql, e)
          reject(e)
        }
      })
      // #endif

      // #ifndef APP-PLUS
      resolve([])
      // #endif
    })
  }

  /**
   * H5环境查询
   */
  async queryH5(sql, params = []) {
    return new Promise((resolve, reject) => {
      // #ifdef H5
      if (!this.db) {
        reject(new Error('数据库未初始化'))
        return
      }

      this.db.transaction((tx) => {
        tx.executeSql(
          sql,
          params,
          (tx, results) => {
            const rows = []
            for (let i = 0; i < results.rows.length; i++) {
              rows.push(results.rows.item(i))
            }
            resolve(rows)
          },
          (tx, error) => {
            console.error('查询失败:', sql, error)
            reject(error)
          }
        )
      })
      // #endif

      // #ifndef H5
      resolve([])
      // #endif
    })
  }

  /**
   * 开启事务
   */
  async beginTransaction() {
    await this.executeSql('BEGIN TRANSACTION')
  }

  /**
   * 提交事务
   */
  async commit() {
    await this.executeSql('COMMIT')
  }

  /**
   * 回滚事务
   */
  async rollback() {
    await this.executeSql('ROLLBACK')
  }

  /**
   * 关闭数据库
   */
  async closeDatabase() {
    return new Promise((resolve) => {
      // #ifdef APP-PLUS
      plus.sqlite.closeDatabase({
        name: this.dbName,
        success: () => {
          this.isInitialized = false
          resolve()
        },
        fail: (e) => {
          console.error('数据库关闭失败:', e)
          resolve()
        }
      })
      // #endif

      // #ifndef APP-PLUS
      this.db = null
      this.isInitialized = false
      resolve()
      // #endif
    })
  }
}

// 导出单例
export default new DatabaseService()
