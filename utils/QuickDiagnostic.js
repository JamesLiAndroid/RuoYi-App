/**
 * 快速诊断工具
 * 用于快速检查数据库状态，不依赖其他复杂逻辑
 */
import DatabaseService from './DatabaseService'

class QuickDiagnostic {
  /**
   * 快速诊断数据库状态
   */
  async run() {
    console.log('╔════════════════════════════════════════════════╗')
    console.log('║          快速数据库诊断开始                    ║')
    console.log('╚════════════════════════════════════════════════╝')

    try {
      // 1. 检查数据库初始化
      console.log('\n【1】检查数据库初始化状态')
      console.log('   数据库已初始化:', DatabaseService.isInitialized)

      if (!DatabaseService.isInitialized) {
        console.error('   ❌ 数据库未初始化！')
        return
      }

      // 2. 检查路线表
      console.log('\n【2】检查路线表 (inspection_route)')
      try {
        const routes = await DatabaseService._query('SELECT * FROM inspection_route', [])
        console.log('   ✓ 路线总数:', routes.length)

        if (routes.length === 0) {
          console.warn('   ⚠️ 路线表是空的！')
        } else {
          console.log('   所有路线:')
          routes.forEach((route, index) => {
            console.log(`   [${index + 1}] ID: ${route.route_id} (${typeof route.route_id}), 名称: ${route.route_name}`)
            if (route.points_json) {
              try {
                const pointIds = JSON.parse(route.points_json)
                console.log(`       └─ 包含 ${pointIds.length} 个点位: ${JSON.stringify(pointIds)}`)
              } catch (e) {
                console.error(`       └─ points_json 解析失败: ${route.points_json}`)
              }
            } else {
              console.warn(`       └─ points_json 为空`)
            }
          })
        }
      } catch (error) {
        console.error('   ❌ 查询路线表失败:', error)
      }

      // 3. 检查点位表
      console.log('\n【3】检查点位表 (inspection_point)')
      try {
        const points = await DatabaseService._query('SELECT * FROM inspection_point', [])
        console.log('   ✓ 点位总数:', points.length)

        if (points.length === 0) {
          console.warn('   ⚠️ 点位表是空的！')
        } else {
          console.log('   前5个点位:')
          points.slice(0, 5).forEach((point, index) => {
            console.log(`   [${index + 1}] ID: ${point.point_id} (${typeof point.point_id}), 名称: ${point.point_name}, 编号: ${point.point_code}`)
          })
          if (points.length > 5) {
            console.log(`   ... 还有 ${points.length - 5} 个点位`)
          }
        }
      } catch (error) {
        console.error('   ❌ 查询点位表失败:', error)
      }

      // 4. 检查任务表
      console.log('\n【4】检查任务表 (inspection_task)')
      try {
        const tasks = await DatabaseService._query('SELECT * FROM inspection_task', [])
        console.log('   ✓ 任务总数:', tasks.length)

        if (tasks.length === 0) {
          console.warn('   ⚠️ 任务表是空的！')
        } else {
          console.log('   前5个任务:')
          tasks.slice(0, 5).forEach((task, index) => {
            console.log(`   [${index + 1}] 任务ID: ${task.task_id} (${typeof task.task_id}), 路线ID: ${task.route_id} (${typeof task.route_id}), 状态: ${task.task_status}`)
          })
          if (tasks.length > 5) {
            console.log(`   ... 还有 ${tasks.length - 5} 个任务`)
          }
        }
      } catch (error) {
        console.error('   ❌ 查询任务表失败:', error)
      }

      // 5. 检查任务-路线关联
      console.log('\n【5】检查任务-路线关联')
      try {
        const tasks = await DatabaseService._query('SELECT * FROM inspection_task LIMIT 1', [])
        if (tasks.length > 0) {
          const task = tasks[0]
          console.log(`   测试任务: ID=${task.task_id}, route_id=${task.route_id}`)

          // 尝试查询对应的路线
          const routes = await DatabaseService._query('SELECT * FROM inspection_route WHERE route_id = ?', [task.route_id])

          if (routes.length > 0) {
            console.log('   ✓ 找到对应路线:', routes[0].route_name)
          } else {
            console.error('   ❌ 找不到对应路线！')
            console.error('   任务的route_id:', task.route_id, '(类型:', typeof task.route_id, ')')

            // 列出所有路线的ID
            const allRoutes = await DatabaseService._query('SELECT route_id, route_name FROM inspection_route', [])
            console.log('   数据库中的路线ID列表:')
            allRoutes.forEach(r => {
              console.log(`     - ${r.route_id} (${typeof r.route_id}): ${r.route_name}`)
            })
          }
        } else {
          console.warn('   ⚠️ 没有任务数据，跳过关联检查')
        }
      } catch (error) {
        console.error('   ❌ 检查任务-路线关联失败:', error)
      }

      // 6. 检查同步元数据
      console.log('\n【6】检查同步元数据 (sync_metadata)')
      try {
        const metadata = await DatabaseService._query('SELECT * FROM sync_metadata', [])
        console.log('   ✓ 同步元数据记录数:', metadata.length)

        if (metadata.length > 0) {
          console.log('   同步元数据:')
          metadata.forEach(m => {
            console.log(`     ${m.key}: ${m.value}`)
          })
        } else {
          console.warn('   ⚠️ 没有同步元数据')
        }
      } catch (error) {
        console.error('   ❌ 查询同步元数据失败:', error)
      }

      console.log('\n╔════════════════════════════════════════════════╗')
      console.log('║          快速数据库诊断完成                    ║')
      console.log('╚════════════════════════════════════════════════╝\n')

    } catch (error) {
      console.error('快速诊断失败:', error)
    }
  }

  /**
   * 检查特定任务的数据完整性
   */
  async checkTask(taskId) {
    console.log(`\n检查任务 ${taskId} 的数据完整性...`)

    try {
      // 查询任务
      const tasks = await DatabaseService._query('SELECT * FROM inspection_task WHERE task_id = ?', [taskId])

      if (tasks.length === 0) {
        console.error(`❌ 任务 ${taskId} 不存在`)
        return
      }

      const task = tasks[0]
      console.log('✓ 任务信息:', {
        task_id: task.task_id,
        route_id: task.route_id,
        task_status: task.task_status
      })

      // 查询关联的路线
      const routes = await DatabaseService._query('SELECT * FROM inspection_route WHERE route_id = ?', [task.route_id])

      if (routes.length === 0) {
        console.error(`❌ 找不到路线 ${task.route_id}`)
        return
      }

      const route = routes[0]
      console.log('✓ 路线信息:', {
        route_id: route.route_id,
        route_name: route.route_name,
        points_json: route.points_json
      })

      // 解析点位ID
      const pointIds = JSON.parse(route.points_json || '[]')
      console.log(`✓ 路线包含 ${pointIds.length} 个点位`)

      // 检查每个点位是否存在
      let foundPoints = 0
      for (const pointId of pointIds) {
        const points = await DatabaseService._query('SELECT * FROM inspection_point WHERE point_id = ?', [pointId])
        if (points.length > 0) {
          foundPoints++
        } else {
          console.warn(`⚠️ 点位 ${pointId} 不存在`)
        }
      }

      console.log(`✓ 找到 ${foundPoints}/${pointIds.length} 个点位`)

    } catch (error) {
      console.error('检查任务失败:', error)
    }
  }
}

export default new QuickDiagnostic()
