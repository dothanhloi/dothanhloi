import type { DeductRule, PresetSnapshot, QualityPreset } from './types';
import { fmtNum } from './format';

export function ruleText(label: string, r: DeductRule): string {
  switch (r.method) {
    case 'none': return `${label}: chỉ ghi nhận`;
    case 'kg': return `${label} chuẩn ${fmtNum(r.standard, 2)}%, vượt 1% trừ ${fmtNum(r.rate, 2)}% kg`;
    case 'price': return `${label} chuẩn ${fmtNum(r.standard, 2)}%, vượt 1% trừ ${Math.round(r.rate).toLocaleString('vi-VN')} đ/kg`;
    case 'table': return `${label}: bảng ${r.table?.length || 0} bậc (${r.tableUnit === 'price' ? 'trừ giá' : 'trừ kg'})`;
    default: return label;
  }
}

export function tareText(p: Pick<PresetSnapshot, 'tareMode' | 'tareValue'>): string {
  if (p.tareMode === 'perBag') return p.tareValue ? `Bì ${fmtNum(p.tareValue, 2)} kg/bao` : 'Không trừ bì';
  if (p.tareMode === 'percent') return p.tareValue ? `Bì ${fmtNum(p.tareValue, 2)}%` : 'Không trừ bì';
  return 'Không trừ bì';
}

export function presetSummary(p: PresetSnapshot | QualityPreset): string {
  return [ruleText('Tạp', p.impurity), ruleText('Độ', p.moisture), tareText(p)].join(' · ');
}
