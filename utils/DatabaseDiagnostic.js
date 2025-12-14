/**
 * 数据库诊断工具
 * 用于检查数据库中的数据状态
 */
import DatabaseService from '@/utils/DatabaseService'

class DatabaseDiagnostic {
  /**
   * 全面诊断数据库状态
   */
  async diagnose() {
    console.log('========== 数据库诊断开始 ==========')

    try {
      // 1. 检查数据库是否初始化
      console.log('[诊断] 1. 检查数据库初始化状态')
      console.log('数据库是否已初始化:', DatabaseService.isInitialized)

      // 2. 检查各表的数据量
      console.log('\n[诊断] 2. 检查各表数据量')
      const tables = [
        'inspection_route',
        'inspection_point',
        'inspection_item',
        'inspection_task',
        'inspection_record',
        'inspection_item_result',
        'sync_metadata'
      ]

      for (const table of tables) {
        try {
          const count = await DatabaseService.count(table)
          console.log(`  ${table}: ${count} 条记录`)
        } catch (error) {
          console.error(`  ${table}: 查询失败 -`, error.message)
        }
      }

      // 3. 检查路线数据详情
      console.log('\n[诊断] 3. 检查路线数据详情')
      const routes = await DatabaseService.findAll('inspection_route')
      console.log(`  共 ${routes.length} 条路线`)
      if (routes.length > 0) {
        console.log('  第一条路线详情:', routes[0])
        console.log('  points_json 内容:', routes[0].points_json)

        // 尝试解析 points_json
        try {
          const pointIds = JSON.parse(routes[0].points_json || '[]')
          console.log('  解析后的点位ID数组:', pointIds)
          console.log('  点位ID数量:', pointIds.length)
        } catch (e) {
          console.error('  points_json 解析失败:', e.message)
        }
      }

      // 4. 检查点位数据详情
      console.log('\n[诊断] 4. 检查点位数据详情')
      const points = await DatabaseService.findAll('inspection_point')
      console.log(`  共 ${points.length} 条点位`)
      if (points.length > 0) {
        console.log('  前3条点位:', points.slice(0, 3))
      }

      // 5. 检查任务数据详情
      console.log('\n[诊断] 5. 检查任务数据详情')
      const tasks = await DatabaseService.findAll('inspection_task')
      console.log(`  共 ${tasks.length} 条任务`)
      if (tasks.length > 0) {
        console.log('  第一条任务详情:', tasks[0])
      }

      // 6. 检查同步元数据
      console.log('\n[诊断] 6. 检查同步元数据')
      const metadata = await DatabaseService.getSyncMetadata()
      console.log('  同步元数据:', metadata)

      // 7. 测试关联查询
      if (tasks.length > 0) {
        console.log('\n[诊断] 7. 测试任务-路线关联查询')
        const taskId = tasks[0].task_id
        const routeId = tasks[0].route_id
        console.log(`  测试任务ID: ${taskId}, 路线ID: ${routeId}`)

        const sql = `
          SELECT
            t.task_id,
            t.route_id,
            r.route_name,
            r.points_json
          FROM inspection_task t
          LEFT JOIN inspection_route r ON t.route_id = r.route_id
          WHERE t.task_id = ?
        `
        const result = await DatabaseService._query(sql, [taskId])
        console.log('  关联查询结果:', result)
      }

      console.log('\n========== 数据库诊断完成 ==========')
      return { success: true }

    } catch (error) {
      console.error('[诊断] 诊断过程出错:', error)
      console.log('\n========== 数据库诊断失败 ==========')
      return { success: false, error: error.message }
    }
  }

  /**
   * 快速检查某个任务的路线点位数据
   */
  async checkTaskRoutePoints(taskId) {
    console.log(`\n========== 检查任务 ${taskId} 的路线点位 ==========`)

    try {
      // 1. 查询任务信息
      const taskSql = 'SELECT * FROM inspection_task WHERE task_id = ?'
      const tasks = await DatabaseService._query(taskSql, [taskId])
      console.log('任务信息:', tasks[0])

      if (tasks.length === 0) {
        console.log('❌ 任务不存在')
        return
      }

      const routeId = tasks[0].route_id
      console.log(`路线ID: ${routeId}`)

      // 2. 查询路线信息
      const routeSql = 'SELECT * FROM inspection_route WHERE route_id = ?'
      const routes = await DatabaseService._query(routeSql, [routeId])
      console.log('路线信息:', routes[0])

      if (routes.length === 0) {
        console.log('❌ 路线不存在')
        return
      }

      // 3. 解析点位ID列表
      const pointsJson = routes[0].points_json
      console.log('points_json 原始值:', pointsJson)

      let pointIds = []
      try {
        pointIds = JSON.parse(pointsJson || '[]')
        console.log('解析后的点位ID数组:', pointIds)
      } catch (e) {
        console.error('❌ points_json 解析失败:', e.message)
        return
      }

      // 4. 查询每个点位的详细信息
      console.log(`\n开始查询 ${pointIds.length} 个点位的详细信息：`)
      for (let i = 0; i < pointIds.length; i++) {
        const pointId = pointIds[i]
        const pointSql = 'SELECT * FROM inspection_point WHERE point_id = ?'
        const pointResults = await DatabaseService._query(pointSql, [pointId])

        if (pointResults.length > 0) {
          console.log(`  ✅ 点位 ${i + 1}: ${pointResults[0].point_name} (ID: ${pointId})`)
        } else {
          console.log(`  ❌ 点位 ${i + 1}: 未找到 (ID: ${pointId})`)
        }
      }

      console.log('\n========== 检查完成 ==========')

    } catch (error) {
      console.error('检查失败:', error)
    }
  }
}

export default new DatabaseDiagnostic()
