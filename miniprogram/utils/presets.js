// utils/presets.js —— 参数预设库
// 场景化一键填充：Wi-Fi / 5G / LoRa / 雷达波段等
// 设计思路：每个预设定义一组典型参数，各计算页面按需取用

const PRESETS = [
  {
    id: 'wifi24',
    name: 'Wi-Fi 2.4G',
    icon: '📶',
    color: '#b06a4f',
    desc: '802.11 b/g/n/ax 2.4GHz',
    params: {
      freq: '2.4',       // GHz
      freqUnit: 1,        // 1=GHz
      bw: '20',           // MHz
      bwUnit: 1,          // 1=MHz
      nf: '4',            // dB
      snr: '20',          // dB (OFDM 64QAM)
      txPower: '20',      // dBm (EIRP 限值)
      txGain: '3',        // dBi (典型全向)
      rxGain: '3',
    }
  },
  {
    id: 'wifi5',
    name: 'Wi-Fi 5G',
    icon: '📶',
    color: '#b06a4f',
    desc: '802.11 a/n/ac/ax 5GHz',
    params: {
      freq: '5.8',
      freqUnit: 1,
      bw: '80',
      bwUnit: 1,
      nf: '4',
      snr: '25',
      txPower: '23',
      txGain: '5',
      rxGain: '5',
    }
  },
  {
    id: 'nr78',
    name: '5G n78',
    icon: '📡',
    color: '#7a9181',
    desc: '5G NR 3.5GHz TDD',
    params: {
      freq: '3.5',
      freqUnit: 1,
      bw: '100',
      bwUnit: 1,
      nf: '5',
      snr: '15',
      txPower: '23',     // 终端功率
      txGain: '0',       // 终端天线
      rxGain: '18',      // 基站天线阵列
    }
  },
  {
    id: 'lora433',
    name: 'LoRa 433M',
    icon: '🛰️',
    color: '#c89b6e',
    desc: 'LoRa LPWAN 433MHz',
    params: {
      freq: '433',
      freqUnit: 0,       // MHz
      bw: '0.125',       // 125 kHz
      bwUnit: 0,         // kHz
      nf: '6',
      snr: '-20',        // LoRa 扩频增益允许负 SNR
      txPower: '14',     // 10mW EIRP
      txGain: '2',
      rxGain: '2',
    }
  },
  {
    id: 'xband',
    name: 'X 波段雷达',
    icon: '🎯',
    color: '#b06a4f',
    desc: '机载/舰载 9.3GHz',
    params: {
      freq: '9.3',
      freqUnit: 1,
      bw: '50',
      bwUnit: 1,
      nf: '3',
      snr: '13',         // 脉冲雷达检测门限
      txPower: '50',     // dBm (100W 峰值)
      txGain: '30',      // dBi (裂缝天线)
      rxGain: '30',
    }
  },
  {
    id: 'sband',
    name: 'S 波段雷达',
    icon: '🎯',
    color: '#7a9181',
    desc: '气象/航海 3.0GHz',
    params: {
      freq: '3.0',
      freqUnit: 1,
      bw: '10',
      bwUnit: 1,
      nf: '3',
      snr: '13',
      txPower: '60',    // dBm (1kW)
      txGain: '35',     // 大型旋转天线
      rxGain: '35',
    }
  },
  {
    id: 'gps',
    name: 'GPS L1',
    icon: '🛰️',
    color: '#c89b6e',
    desc: 'GNSS 1575.42MHz',
    params: {
      freq: '1.575',
      freqUnit: 1,
      bw: '2',          // 2 MHz C/A 码
      bwUnit: 1,
      nf: '2',          // LNA 低噪声
      snr: '30',        // 相关解扩后
      txPower: '13',    // 卫星 EIRP ~13 dBm 接收
      txGain: '0',
      rxGain: '4',      // 贴片天线
    }
  },
  {
    id: 'bluetooth',
    name: '蓝牙 BLE',
    icon: '📱',
    color: '#b06a4f',
    desc: 'BLE 5.0 2.4GHz',
    params: {
      freq: '2.4',
      freqUnit: 1,
      bw: '2',
      bwUnit: 1,
      nf: '8',          // 低功耗接收机
      snr: '15',
      txPower: '0',     // 0 dBm (1mW)
      txGain: '0',
      rxGain: '0',
    }
  },
]

/**
 * 获取所有预设
 */
function getAll() {
  return PRESETS
}

/**
 * 按 id 获取预设
 */
function getById(id) {
  return PRESETS.find(p => p.id === id)
}

module.exports = { PRESETS, getAll, getById }
