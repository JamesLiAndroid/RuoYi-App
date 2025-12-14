/**
 * 点位状态常量定义
 * 用于巡检记录状态管理
 */

// 点位状态枚举
export const PointStatus = {
  PENDING: 'PENDING',     // 待巡检
  COMPLETED: 'COMPLETED', // 已完成
  SKIPPED: 'SKIPPED'      // 已跳检
}

// 点位状态显示文本
export const PointStatusText = {
  [PointStatus.PENDING]: '待巡检',
  [PointStatus.COMPLETED]: '已完成',
  [PointStatus.SKIPPED]: '已跳检'
}

// 点位状态颜色（用于UI显示）
export const PointStatusColor = {
  [PointStatus.PENDING]: '#ff7875',   // 红色
  [PointStatus.COMPLETED]: '#52c41a', // 绿色
  [PointStatus.SKIPPED]: '#faad14'    // 橙色
}

// 跳检原因预设值
export const SkipReasons = [
  {
    code: 'DEVICE_UNREACHABLE',
    name: '设备不可达',
    description: '设备所在区域无法进入或到达'
  },
  {
    code: 'DEVICE_MAINTENANCE',
    name: '设备停机检修',
    description: '设备正在进行停机维修或保养'
  },
  {
    code: 'DEVICE_REMOVED',
    name: '设备已拆除',
    description: '设备已经被拆除或移除'
  },
  {
    code: 'NFC_DAMAGED',
    name: 'NFC卡损坏或丢失',
    description: 'NFC卡片损坏、丢失或无法读取'
  },
  {
    code: 'OTHER',
    name: '其他原因',
    description: '其他未列出的跳检原因'
  }
]

// 备注最大长度
export const REMARK_MAX_LENGTH = 1000

// 跳检原因最大长度
export const SKIP_REASON_MAX_LENGTH = 500

export default {
  PointStatus,
  PointStatusText,
  PointStatusColor,
  SkipReasons,
  REMARK_MAX_LENGTH,
  SKIP_REASON_MAX_LENGTH
}
