/**
 * SQLite数据库服务
 * 提供巡检数据的本地存储和管理功能
 *
 * @author James (Developer Agent)
 * @date 2025-11-25
 */

const DB_NAME = 'inspection.db'
const DB_VERSION = 1
const DB_SCHEMA_VERSION = '1.3.1' // 数据库结构版本号（修复参数传递bug，确保数据正确插入）

class DatabaseService {
  constructor() {
    this.db = null
    this.isInitialized = false
  }

  /**
   * 初始化数据库
   */
  async init() {
    if (this.isInitialized && this.db) {
      console.log('[DatabaseService] 数据库已初始化，跳过')
      return Promise.resolve()
    }

    console.log('[DatabaseService] 开始初始化数据库...')

    return new Promise((resolve, reject) => {
      // #ifdef APP-PLUS
      console.log('[DatabaseService] APP-PLUS环境，检查plus对象...')

      // 检查plus对象是否就绪
      if (!plus) {
        console.error('[DatabaseService] plus对象未就绪')
        reject(new Error('plus对象未就绪，请稍后再试'))
        return
      }

      if (!plus.sqlite) {
        console.error('[DatabaseService] plus.sqlite不可用')
        reject(new Error('当前环境不支持SQLite数据库'))
        return
      }

      // 先检查数据库是否已经打开
      const isOpen = plus.sqlite.isOpenDatabase({
        name: DB_NAME,
        path: '_doc/' + DB_NAME
      })

      if (isOpen) {
        console.log('[DatabaseService] 数据库已经打开，直接使用')
        this.db = { name: DB_NAME, path: '_doc/' + DB_NAME }
        this.isInitialized = true

        // 检查数据库结构
        this._checkAndUpgradeSchema().then(() => {
          console.log('[DatabaseService] 数据库结构检查完成')
          resolve()
        }).catch((error) => {
          console.warn('[DatabaseService] 数据库结构检查警告:', error)
          // 即使检查失败，也认为初始化成功
          resolve()
        })
        return
      }

      console.log('[DatabaseService] 正在打开数据库:', DB_NAME)

      // 尝试打开数据库
      plus.sqlite.openDatabase({
        name: DB_NAME,
        path: '_doc/' + DB_NAME,
        success: (db) => {
          console.log('[DatabaseService] 数据库打开成功')
          this.db = db
          this.isInitialized = true

          console.log('[DatabaseService] 开始检查数据库版本...')
          this._checkAndUpgradeSchema().then(() => {
            console.log('[DatabaseService] 数据库结构检查完成')
            resolve()
          }).catch((error) => {
            console.error('[DatabaseService] 数据库结构检查失败:', error)
            reject(error)
          })
        },
        fail: (error) => {
          console.error('[DatabaseService] 数据库打开失败:', error)

          // 如果是-1402错误（数据库已打开）
          if (error.code === -1402 || (error.message && error.message.includes('Already Open'))) {
            console.log('[DatabaseService] 数据库已打开(错误-1402)，直接标记为已初始化')

            // 标记为已初始化
            this.db = { name: DB_NAME, path: '_doc/' + DB_NAME }
            this.isInitialized = true

            // 尝试创建表（如果表已存在会忽略）
            console.log('[DatabaseService] 检查数据库版本...')
            this._checkAndUpgradeSchema().then(() => {
              console.log('[DatabaseService] 数据库结构检查完成')
              resolve()
            }).catch((tableError) => {
              // 即使检查失败，也认为初始化成功（表可能已存在）
              console.warn('[DatabaseService] 数据库结构检查警告:', tableError)
              resolve()
            })
          } else {
            reject(new Error('数据库打开失败: ' + JSON.stringify(error)))
          }
        }
      })
      // #endif

      // #ifdef H5
      console.warn('[DatabaseService] H5环境不支持SQLite数据库')
      reject(new Error('H5环境不支持SQLite数据库，请在真机或模拟器上测试'))
      // #endif

      // #ifdef MP-WEIXIN
      console.warn('[DatabaseService] 微信小程序环境不支持SQLite数据库')
      reject(new Error('微信小程序环境不支持SQLite数据库'))
      // #endif
    })
  }

  /**
   * 创建数据表
   */
  async _createTables() {
    console.log('[DatabaseService] _createTables: 开始创建数据表')

    const tables = [
      // 巡检路线表
      `CREATE TABLE IF NOT EXISTS inspection_route (
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
      )`,
      // 巡检点位表
      `CREATE TABLE IF NOT EXISTS inspection_point (
        point_id INTEGER PRIMARY KEY,
        point_code TEXT,
        point_name TEXT,
        location TEXT,
        dept_id INTEGER,
        card_id TEXT,
        device_type TEXT,
        sync_time TEXT,
        version INTEGER
      )`,
      // 巡查项目表
      `CREATE TABLE IF NOT EXISTS inspection_item (
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
      )`,
      // 巡检任务表
      `CREATE TABLE IF NOT EXISTS inspection_task (
        task_id INTEGER PRIMARY KEY,
        task_code TEXT,
        route_id INTEGER,
        route_name TEXT,
        inspector_id INTEGER,
        inspector_name TEXT,
        task_date TEXT,
        task_status TEXT,
        planned_start_time TEXT,
        planned_end_time TEXT,
        actual_start_time TEXT,
        actual_end_time TEXT,
        current_point_index INTEGER DEFAULT 0,
        total_points INTEGER DEFAULT 0,
        sync_time TEXT,
        version INTEGER
      )`,
      // 巡检记录表
      `CREATE TABLE IF NOT EXISTS inspection_record (
        record_id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER NOT NULL,
        point_id INTEGER NOT NULL,
        nfc_uid TEXT,
        verification_method TEXT,
        qr_code_content TEXT,
        image_urls TEXT,
        remark TEXT,
        inspection_time TEXT DEFAULT (datetime('now', 'localtime')),
        sync_status INTEGER DEFAULT 0 CHECK (sync_status IN (0, 1)),
        deleted INTEGER DEFAULT 0 CHECK (deleted IN (0, 1)),
        create_time TEXT DEFAULT (datetime('now', 'localtime')),
        update_time TEXT DEFAULT (datetime('now', 'localtime'))
      )`,
      // 巡查项目结果表（新增）
      `CREATE TABLE IF NOT EXISTS inspection_item_result (
        result_id INTEGER PRIMARY KEY AUTOINCREMENT,
        record_id INTEGER NOT NULL,
        item_id INTEGER NOT NULL,
        item_name TEXT NOT NULL,
        item_type TEXT NOT NULL CHECK (item_type IN ('status', 'numeric', 'text')),
        actual_value TEXT NOT NULL,
        is_abnormal INTEGER DEFAULT 0 CHECK (is_abnormal IN (0, 1)),
        abnormal_remark TEXT,
        sync_status INTEGER DEFAULT 0 CHECK (sync_status IN (0, 1)),
        deleted INTEGER DEFAULT 0 CHECK (deleted IN (0, 1)),
        create_time TEXT DEFAULT (datetime('now', 'localtime')),
        update_time TEXT DEFAULT (datetime('now', 'localtime'))
      )`,
      // 同步元数据表
      `CREATE TABLE IF NOT EXISTS sync_metadata (
        table_name TEXT PRIMARY KEY,
        version TEXT,
        last_sync_time TEXT
      )`
    ]

    const tableNames = [
      'inspection_route',
      'inspection_point',
      'inspection_item',
      'inspection_task',
      'inspection_record',
      'inspection_item_result',
      'sync_metadata'
    ]

    for (let i = 0; i < tables.length; i++) {
      const sql = tables[i]
      const tableName = tableNames[i]
      console.log(`[DatabaseService] 创建表: ${tableName}`)

      try {
        await this._executeSQL(sql)
        console.log(`[DatabaseService] 表 ${tableName} 创建成功`)
      } catch (error) {
        console.error(`[DatabaseService] 表 ${tableName} 创建失败:`, error)
        throw error
      }
    }

    // 创建索引
    await this._createIndexes()

    console.log('[DatabaseService] _createTables: 所有数据表创建完成')
  }

  /**
   * 创建索引
   */
  async _createIndexes() {
    console.log('[DatabaseService] _createIndexes: 开始创建索引')

    const indexes = [
      // inspection_record 表索引
      'CREATE INDEX IF NOT EXISTS idx_record_task_id ON inspection_record(task_id)',
      'CREATE INDEX IF NOT EXISTS idx_record_point_id ON inspection_record(point_id)',
      'CREATE INDEX IF NOT EXISTS idx_record_sync_status ON inspection_record(sync_status)',
      'CREATE INDEX IF NOT EXISTS idx_record_deleted ON inspection_record(deleted)',
      // inspection_item_result 表索引
      'CREATE INDEX IF NOT EXISTS idx_result_record_id ON inspection_item_result(record_id)',
      'CREATE INDEX IF NOT EXISTS idx_result_item_id ON inspection_item_result(item_id)',
      'CREATE INDEX IF NOT EXISTS idx_result_item_type ON inspection_item_result(item_type)',
      'CREATE INDEX IF NOT EXISTS idx_result_abnormal ON inspection_item_result(is_abnormal)',
      'CREATE INDEX IF NOT EXISTS idx_result_sync_status ON inspection_item_result(sync_status)',
      'CREATE INDEX IF NOT EXISTS idx_result_deleted ON inspection_item_result(deleted)'
    ]

    for (const indexSQL of indexes) {
      try {
        await this._executeSQL(indexSQL)
      } catch (error) {
        console.warn('[DatabaseService] 创建索引失败:', error)
        // 继续创建其他索引
      }
    }

    console.log('[DatabaseService] _createIndexes: 索引创建完成')
  }

  /**
   * 检查并升级数据库结构
   */
  async _checkAndUpgradeSchema() {
    console.log('[DatabaseService] _checkAndUpgradeSchema: 检查数据库版本')

    try {
      // 首先确保sync_metadata表存在
      await this._executeSQL(`
        CREATE TABLE IF NOT EXISTS sync_metadata (
          table_name TEXT PRIMARY KEY,
          version TEXT,
          last_sync_time TEXT
        )
      `)

      // 检查当前数据库结构版本
      const result = await this._query(`SELECT version FROM sync_metadata WHERE table_name = '__schema__'`)
      const currentVersion = result.length > 0 ? result[0].version : null

      console.log(`[DatabaseService] 当前数据库版本: ${currentVersion}, 目标版本: ${DB_SCHEMA_VERSION}`)

      if (currentVersion !== DB_SCHEMA_VERSION) {
        console.log('[DatabaseService] 数据库版本不匹配，需要升级')

        // 删除所有旧表
        await this._dropAllTables()

        // 重新创建所有表
        await this._createTables()

        // 更新数据库结构版本
        const now = new Date().toISOString()
        await this._executeSQL(`
          INSERT OR REPLACE INTO sync_metadata (table_name, version, last_sync_time)
          VALUES ('__schema__', '${DB_SCHEMA_VERSION}', '${now}')
        `)

        console.log('[DatabaseService] 数据库升级完成')
      } else {
        console.log('[DatabaseService] 数据库版本匹配，无需升级')

        // 确保所有表都存在（防止表被意外删除）
        await this._createTables()
      }
    } catch (error) {
      console.error('[DatabaseService] 数据库版本检查失败:', error)

      // 如果检查失败，尝试重建所有表
      console.log('[DatabaseService] 尝试重建所有表...')
      try {
        await this._dropAllTables()
        await this._createTables()
        const now = new Date().toISOString()
        await this._executeSQL(`
          INSERT OR REPLACE INTO sync_metadata (table_name, version, last_sync_time)
          VALUES ('__schema__', '${DB_SCHEMA_VERSION}', '${now}')
        `)
        console.log('[DatabaseService] 数据库重建成功')
      } catch (rebuildError) {
        console.error('[DatabaseService] 数据库重建失败:', rebuildError)
        throw rebuildError
      }
    }
  }

  /**
   * 删除所有数据表
   */
  async _dropAllTables() {
    console.log('[DatabaseService] _dropAllTables: 开始删除所有旧表')

    const tables = [
      'inspection_route',
      'inspection_point',
      'inspection_item',
      'inspection_task',
      'inspection_record',
      'inspection_item_result'
    ]

    for (const tableName of tables) {
      try {
        console.log(`[DatabaseService] 删除表: ${tableName}`)
        await this._executeSQL(`DROP TABLE IF EXISTS ${tableName}`)
      } catch (error) {
        console.warn(`[DatabaseService] 删除表 ${tableName} 失败:`, error)
        // 继续删除其他表
      }
    }

    console.log('[DatabaseService] _dropAllTables: 所有旧表删除完成')
  }

  /**
   * 执行SQL语句
   * @param sql SQL语句
   * @param params 参数数组
   */
  _executeSQL(sql, params = []) {
    return new Promise((resolve, reject) => {
      // #ifdef APP-PLUS
      if (!this.db) {
        console.error('[DatabaseService] 数据库未初始化')
        reject(new Error('数据库未初始化'))
        return
      }

      // 🔧 关键修复：手动替换占位符，因为plus.sqlite.executeSql不支持参数化查询
      let finalSql = sql
      if (params && params.length > 0) {
        // 将params中的值替换到SQL中的?占位符
        for (let i = 0; i < params.length; i++) {
          const value = params[i]
          let replacedValue

          if (value === null || value === undefined) {
            replacedValue = 'NULL'
          } else if (typeof value === 'string') {
            // 字符串需要转义单引号并用单引号包裹
            replacedValue = `'${value.replace(/'/g, "''")}'`
          } else if (typeof value === 'number') {
            replacedValue = value.toString()
          } else if (typeof value === 'boolean') {
            replacedValue = value ? '1' : '0'
          } else {
            // 其他类型转为字符串
            replacedValue = `'${String(value).replace(/'/g, "''")}'`
          }

          // 替换第一个?
          finalSql = finalSql.replace('?', replacedValue)
        }
      }

      // 构建执行SQL的参数对象
      const execParams = {
        name: DB_NAME,  // 使用数据库名称而不是db对象
        sql: finalSql,
        success: (res) => {
          resolve(res)
        },
        fail: (error) => {
          console.error('[DatabaseService] SQL执行失败:', finalSql, error)
          reject(error)
        }
      }

      plus.sqlite.executeSql(execParams)
      // #endif

      // #ifdef H5
      console.warn('[DatabaseService] H5环境不支持SQLite操作')
      reject(new Error('H5环境不支持SQLite操作'))
      // #endif
    })
  }

  /**
   * 查询数据
   * @param sql SQL语句
   * @param params 参数数组
   */
  _query(sql, params = []) {
    return new Promise((resolve, reject) => {
      // #ifdef APP-PLUS
      if (!this.db) {
        console.error('[DatabaseService] 数据库未初始化')
        reject(new Error('数据库未初始化'))
        return
      }

      // 🔧 关键修复：手动替换占位符，因为plus.sqlite.selectSql不支持参数化查询
      let finalSql = sql
      if (params && params.length > 0) {
        // 将params中的值替换到SQL中的?占位符
        for (let i = 0; i < params.length; i++) {
          const value = params[i]
          let replacedValue

          if (value === null || value === undefined) {
            replacedValue = 'NULL'
          } else if (typeof value === 'string') {
            // 字符串需要转义单引号并用单引号包裹
            replacedValue = `'${value.replace(/'/g, "''")}'`
          } else if (typeof value === 'number') {
            replacedValue = value.toString()
          } else if (typeof value === 'boolean') {
            replacedValue = value ? '1' : '0'
          } else {
            // 其他类型转为字符串
            replacedValue = `'${String(value).replace(/'/g, "''")}'`
          }

          // 替换第一个?
          finalSql = finalSql.replace('?', replacedValue)
        }
      }

      // 构建查询SQL的参数对象
      const queryParams = {
        name: DB_NAME,  // 使用数据库名称而不是db对象
        sql: finalSql,
        success: (res) => {
          resolve(res)
        },
        fail: (error) => {
          console.error('[DatabaseService] SQL查询失败:', finalSql, error)
          reject(error)
        }
      }

      plus.sqlite.selectSql(queryParams)
      // #endif

      // #ifdef H5
      console.warn('[DatabaseService] H5环境不支持SQLite操作')
      reject(new Error('H5环境不支持SQLite操作'))
      // #endif
    })
  }

  /**
   * 开始事务
   */
  async beginTransaction() {
    await this._executeSQL('BEGIN TRANSACTION')
  }

  /**
   * 提交事务
   */
  async commit() {
    await this._executeSQL('COMMIT')
  }

  /**
   * 回滚事务
   */
  async rollback() {
    await this._executeSQL('ROLLBACK')
  }

  /**
   * 清空表数据
   * @param tableName 表名
   */
  async clearTable(tableName) {
    await this._executeSQL(`DELETE FROM ${tableName}`)
  }

  /**
   * 批量插入数据
   * @param tableName 表名
   * @param dataArray 数据数组
   */
  async batchInsert(tableName, dataArray) {
    if (!dataArray || dataArray.length === 0) {
      console.log(`[DatabaseService] batchInsert: ${tableName} 数据为空，跳过`)
      return
    }

    console.log(`[DatabaseService] batchInsert: 开始插入 ${dataArray.length} 条数据到 ${tableName}`)

    await this.beginTransaction()

    try {
      // 获取表结构（字段名）
      const firstItem = dataArray[0]
      const fields = Object.keys(firstItem)

      console.log(`[DatabaseService] batchInsert: 字段列表:`, fields)

      // 构建SQL语句（使用 INSERT OR REPLACE 避免主键冲突）
      const placeholders = fields.map(() => '?').join(',')
      const sql = `INSERT OR REPLACE INTO ${tableName} (${fields.join(',')}) VALUES (${placeholders})`

      console.log(`[DatabaseService] batchInsert: SQL:`, sql)

      // 批量执行
      for (let i = 0; i < dataArray.length; i++) {
        const item = dataArray[i]
        const values = fields.map(field => item[field])
        await this._executeSQL(sql, values)

        if (i % 10 === 0) {
          console.log(`[DatabaseService] batchInsert: 已插入 ${i + 1}/${dataArray.length}`)
        }
      }

      await this.commit()
      console.log(`[DatabaseService] batchInsert: ${tableName} 插入完成，共 ${dataArray.length} 条`)
    } catch (error) {
      console.error(`[DatabaseService] batchInsert: ${tableName} 插入失败:`, error)
      await this.rollback()
      throw error
    }
  }

  /**
   * 更新数据
   * @param tableName 表名
   * @param data 数据对象（包含ID）
   * @param idField ID字段名
   */
  async update(tableName, data, idField = 'id') {
    const fields = Object.keys(data)
    const values = Object.values(data)

    // 构建SET语句
    const setClause = fields
      .filter(field => field !== idField)
      .map(field => `${field} = ?`)
      .join(', ')

    const sql = `UPDATE ${tableName} SET ${setClause} WHERE ${idField} = ?`
    const params = [
      ...fields.filter(field => field !== idField).map(field => data[field]),
      data[idField]
    ]

    await this._executeSQL(sql, params)
  }

  /**
   * 查询单条数据
   * @param tableName 表名
   * @param id ID值
   * @param idField ID字段名
   */
  async findById(tableName, id, idField = 'id') {
    const sql = `SELECT * FROM ${tableName} WHERE ${idField} = ? LIMIT 1`
    const result = await this._query(sql, [id])
    return result.length > 0 ? result[0] : null
  }

  /**
   * 查询多条数据
   * @param tableName 表名
   * @param condition 查询条件
   * @param params 参数数组
   */
  async find(tableName, condition = '', params = []) {
    let sql = `SELECT * FROM ${tableName}`
    if (condition) {
      sql += ` WHERE ${condition}`
    }
    return await this._query(sql, params)
  }

  /**
   * 查询所有数据
   * @param tableName 表名
   */
  async findAll(tableName) {
    const sql = `SELECT * FROM ${tableName}`
    return await this._query(sql)
  }

  /**
   * 更新同步元数据
   * @param tableName 表名
   * @param version 版本号
   */
  async updateSyncMetadata(tableName, version) {
    const sql = `
      INSERT OR REPLACE INTO sync_metadata (table_name, version, last_sync_time)
      VALUES (?, ?, ?)
    `
    const now = new Date().toISOString()
    await this._executeSQL(sql, [tableName, version, now])
  }

  /**
   * 获取同步元数据
   */
  async getSyncMetadata() {
    const sql = `SELECT * FROM sync_metadata`
    const result = await this._query(sql)
    const metadata = {}
    result.forEach(item => {
      metadata[item.table_name] = {
        version: item.version,
        lastSyncTime: item.last_sync_time
      }
    })
    return metadata
  }

  /**
   * 获取表的版本信息
   * @param tableName 表名
   */
  async getTableVersion(tableName) {
    const sql = `SELECT version FROM sync_metadata WHERE table_name = ?`
    const result = await this._query(sql, [tableName])
    return result.length > 0 ? result[0].version : null
  }

  /**
   * 获取数据总数
   * @param tableName 表名
   * @param condition 查询条件
   * @param params 参数数组
   */
  async count(tableName, condition = '', params = []) {
    let sql = `SELECT COUNT(*) as count FROM ${tableName}`
    if (condition) {
      sql += ` WHERE ${condition}`
    }
    const result = await this._query(sql, params)
    return result[0].count
  }

  /**
   * 同步路线数据
   * @param routesData 路线数据数组
   */
  async syncRoutes(routesData) {
    console.log('[DatabaseService] syncRoutes: 开始同步路线数据')
    console.log('[DatabaseService] syncRoutes: 接收到的数据:', routesData)

    if (!routesData || routesData.length === 0) {
      console.warn('[DatabaseService] syncRoutes: 路线数据为空')
      return
    }

    // 🔧 关键修复：先清空旧数据，确保全量替换
    console.log('[DatabaseService] syncRoutes: 清空旧的路线数据...')
    try {
      await this._executeSQL('DELETE FROM inspection_route', [])
      console.log('[DatabaseService] syncRoutes: 旧数据已清空')
    } catch (error) {
      console.error('[DatabaseService] syncRoutes: 清空旧数据失败:', error)
    }

    const mappedData = routesData.map(route => {
      const mapped = {
        route_id: route.routeId || route.route_id,
        route_name: route.routeName || route.route_name,
        route_code: route.routeCode || route.route_code,
        dept_id: route.deptId || route.dept_id,
        cycle_id: route.cycleId || route.cycle_id,
        period_id: route.periodId || route.period_id,
        is_enabled: route.isEnabled !== undefined ? route.isEnabled : (route.is_enabled !== undefined ? route.is_enabled : 1),
        points_json: JSON.stringify(route.points || route.pointIds || []),
        sync_time: new Date().toISOString(),
        version: 1
      }
      console.log('[DatabaseService] syncRoutes: 映射后的路线数据:', mapped)
      return mapped
    })

    await this.batchInsert('inspection_route', mappedData)
  }

  /**
   * 同步点位数据
   * @param pointsData 点位数据数组
   */
  async syncPoints(pointsData) {
    console.log('[DatabaseService] syncPoints: 开始同步点位数据')
    console.log('[DatabaseService] syncPoints: 接收到的数据数量:', pointsData?.length)

    if (!pointsData || pointsData.length === 0) {
      console.warn('[DatabaseService] syncPoints: 点位数据为空')
      return
    }

    // 🔧 关键修复：先清空旧数据，确保全量替换
    console.log('[DatabaseService] syncPoints: 清空旧的点位数据...')
    try {
      await this._executeSQL('DELETE FROM inspection_point', [])
      console.log('[DatabaseService] syncPoints: 旧数据已清空')
    } catch (error) {
      console.error('[DatabaseService] syncPoints: 清空旧数据失败:', error)
    }

    const mappedData = pointsData.map(point => ({
      point_id: point.pointId || point.point_id,
      point_code: point.pointCode || point.point_code,
      point_name: point.pointName || point.point_name,
      location: point.location,
      dept_id: point.deptId || point.dept_id,
      card_id: point.cardId || point.card_id,
      device_type: point.deviceType || point.device_type,
      sync_time: new Date().toISOString(),
      version: 1
    }))

    console.log('[DatabaseService] syncPoints: 映射后的第一条数据:', mappedData[0])

    await this.batchInsert('inspection_point', mappedData)
  }

  /**
   * 同步巡查项目数据
   * @param itemsData 项目数据数组
   */
  async syncItems(itemsData) {
    console.log('[DatabaseService] syncItems: 开始同步巡查项目数据')
    console.log('[DatabaseService] syncItems: 接收到的数据数量:', itemsData?.length)

    if (!itemsData || itemsData.length === 0) {
      console.warn('[DatabaseService] syncItems: 巡查项目数据为空')
      return
    }

    // 🔧 关键修复：先清空旧数据，确保全量替换
    console.log('[DatabaseService] syncItems: 清空旧的巡查项目数据...')
    try {
      await this._executeSQL('DELETE FROM inspection_item', [])
      console.log('[DatabaseService] syncItems: 旧数据已清空')
    } catch (error) {
      console.error('[DatabaseService] syncItems: 清空旧数据失败:', error)
    }

    const mappedData = itemsData.map(item => ({
      item_id: item.itemId || item.item_id,
      point_id: item.pointId || item.point_id,
      item_name: item.itemName || item.item_name,
      item_type: item.itemType || item.item_type,
      order_num: item.orderNum || item.order_num,
      default_value: item.defaultValue || item.default_value,
      options: item.options ? JSON.stringify(item.options) : null,
      min_value: item.minValue || item.min_value,
      max_value: item.maxValue || item.max_value,
      unit: item.unit,
      description: item.description,
      sync_time: new Date().toISOString(),
      version: 1
    }))

    console.log('[DatabaseService] syncItems: 映射后的第一条数据:', mappedData[0])

    await this.batchInsert('inspection_item', mappedData)
  }

  /**
   * 同步任务数据
   * @param tasksData 任务数据数组
   */
  async syncTasks(tasksData) {
    console.log('[DatabaseService] syncTasks: 开始同步任务数据')
    console.log('[DatabaseService] syncTasks: 接收到的数据数量:', tasksData?.length)

    if (!tasksData || tasksData.length === 0) {
      console.warn('[DatabaseService] syncTasks: 任务数据为空')
      return
    }

    // 🔧 关键修复：先清空旧数据，确保全量替换
    console.log('[DatabaseService] syncTasks: 清空旧的任务数据...')
    try {
      await this._executeSQL('DELETE FROM inspection_task', [])
      console.log('[DatabaseService] syncTasks: 旧数据已清空')
    } catch (error) {
      console.error('[DatabaseService] syncTasks: 清空旧数据失败:', error)
    }

    const mappedData = tasksData.map(task => {
      const mapped = {
        task_id: task.taskId || task.task_id,
        task_code: task.taskCode || task.task_code,
        route_id: task.routeId || task.route_id,
        route_name: task.routeName || task.route_name || '',
        inspector_id: task.inspectorId || task.inspector_id,
        inspector_name: task.inspectorName || task.inspector_name || '',
        task_date: task.taskDate || task.task_date || task.plannedStartTime?.substring(0, 10) || '',
        task_status: task.status || task.taskStatus || task.task_status,
        planned_start_time: task.plannedStartTime || task.planned_start_time,
        planned_end_time: task.plannedEndTime || task.planned_end_time,
        actual_start_time: task.actualStartTime || task.actual_start_time,
        actual_end_time: task.actualEndTime || task.actual_end_time,
        current_point_index: task.currentPointIndex || task.current_point_index || 0,
        total_points: task.totalPoints || task.total_points || task.pointCount || 0,
        sync_time: new Date().toISOString(),
        version: 1
      }
      return mapped
    })

    console.log('[DatabaseService] syncTasks: 映射后的第一条数据:', mappedData[0])

    await this.batchInsert('inspection_task', mappedData)
  }

  /**
   * 获取本地路线列表
   */
  async getLocalRoutes() {
    return await this.find('inspection_route', 'is_enabled = 1')
  }

  /**
   * 获取本地点位列表
   */
  async getLocalPoints() {
    return await this.findAll('inspection_point')
  }

  /**
   * 获取本地项目列表
   */
  async getLocalItems() {
    return await this.findAll('inspection_item')
  }

  /**
   * 获取本地任务列表
   */
  async getLocalTasks(status = null) {
    if (status) {
      return await this.find('inspection_task', 'task_status = ?', [status])
    }
    return await this.findAll('inspection_task')
  }

  /**
   * 检查点位是否已巡检
   * @param {Number} taskId - 任务ID
   * @param {Number} pointId - 点位ID
   * @returns {Promise<Boolean>} - 是否已巡检
   */
  async isPointInspected(taskId, pointId) {
    try {
      // 检查 inspection_record 表中是否存在该任务和点位的记录
      // 注意：需要先确保数据库中有 inspection_record 表
      const sql = `
        SELECT COUNT(*) as count
        FROM inspection_record
        WHERE task_id = ? AND point_id = ?
      `
      const results = await this._query(sql, [taskId, pointId])
      return results && results[0] && results[0].count > 0
    } catch (error) {
      console.error('[DatabaseService] 检查点位是否已巡检失败:', error)
      // 如果表不存在或查询失败，返回false
      return false
    }
  }

  /**
   * 关闭数据库连接
   */
  close() {
    if (this.isInitialized) {
      // #ifdef APP-PLUS
      console.log('[DatabaseService] 关闭数据库连接')
      plus.sqlite.closeDatabase({
        name: DB_NAME,
        success: () => {
          console.log('[DatabaseService] 数据库连接已关闭')
          this.db = null
          this.isInitialized = false
        },
        fail: (error) => {
          console.error('[DatabaseService] 关闭数据库失败:', error)
          // 即使关闭失败，也重置状态
          this.db = null
          this.isInitialized = false
        }
      })
      // #endif

      // #ifndef APP-PLUS
      this.db = null
      this.isInitialized = false
      // #endif
    }
  }
}

// 导出单例
export default new DatabaseService()
