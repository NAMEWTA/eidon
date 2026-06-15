/* ============================================================
   EIDON 基座 v2 — Consistency Panel
   PRD §9.3 FR-SYNC-3 五类异常：
     outOfPlace（越界）/ clutter（待整理杂物）/ orphan（孤儿，父级缺失）/
     disconnected（失联，运行时软态，重建索引即丢失）/ repair（待修复结构）
   ============================================================ */
const { useState: useCPSt } = React;

function SectionHeader({ icon, title, count, color, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      width: '100%', display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 16px', border: 'none', background: active ? 'var(--surface-2)' : 'transparent',
      cursor: 'pointer', borderRadius: 6, textAlign: 'left',
      borderLeft: active ? `3px solid ${color}` : '3px solid transparent',
    }}>
      <span style={{ fontSize: 18 }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: active ? 'var(--text-1)' : 'var(--text-2)' }}>{title}</div>
      </div>
      {count > 0 ? (
        <span style={{
          background: color, color: '#000', borderRadius: 10,
          minWidth: 20, height: 18, padding: '0 6px', fontSize: 11, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>{count}</span>
      ) : (
        <span style={{ fontSize: 11, color: 'oklch(0.60 0.12 145)', background: 'oklch(0.18 0.05 145)', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>
          ✓ 清洁
        </span>
      )}
    </button>
  );
}

// ─── Out of Place Section ──────────────────────────────────
function OutOfPlaceSection({ onSelectNode }) {
  const oopNodes = NODES.filter(n => n.flags?.outOfPlace);
  return (
    <div>
      <div style={{ padding: '0 16px 12px', fontSize: 12.5, color: 'var(--text-3)', lineHeight: 1.6 }}>
        以下节点被移动到其模板预期之外的位置。EIDON 不会自动移回——字段与内容保持原样，由你决定如何处理。
      </div>
      {oopNodes.map(node => {
        const tpl = getTemplate(node.templateId);
        const schema = getSchema(node.templateId, node.level, node.schemaVersion);
        const parent = node.parentId ? getNode(node.parentId) : null;
        const parentTpl = parent ? getTemplate(parent.templateId) : null;
        return (
          <div key={node.id} style={{
            margin: '0 12px 10px',
            background: 'var(--surface)', border: '1px solid oklch(0.38 0.10 55)',
            borderRadius: 10, overflow: 'hidden',
          }}>
            <div style={{
              padding: '12px 16px', background: 'oklch(0.18 0.05 55)',
              borderBottom: '1px solid oklch(0.30 0.08 55)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 18, height: 18, borderRadius: 3, background: tpl?.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.9)',
                }}>{tpl?.glyph}</div>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-1)' }}>{node.name}</span>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: 'oklch(0.70 0.12 55)', fontWeight: 600 }}>⬦ 越界</span>
              </div>
              <div style={{ marginTop: 6, fontSize: 12, color: 'oklch(0.60 0.08 55)' }}>
                <strong>{tpl?.name}</strong>「{schema?.levelName}」
                {parent ? (
                  <> 位于 <strong style={{ color: parentTpl?.color }}>{parentTpl?.name}</strong>「{parent.name}」下</>
                ) : '（位于工作区根）'}
              </div>
            </div>
            <div style={{ padding: '10px 16px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={() => onSelectNode(node.id)} style={{
                background: 'var(--surface-2)', color: 'var(--text-1)',
                border: '1px solid var(--border)', borderRadius: 5,
                padding: '5px 12px', fontSize: 12, cursor: 'pointer',
              }}>查看节点</button>
              <button style={{
                background: 'transparent', color: 'var(--text-2)',
                border: '1px solid var(--border)', borderRadius: 5,
                padding: '5px 12px', fontSize: 12, cursor: 'pointer',
              }}>接受现状</button>
              <button style={{
                background: 'transparent', color: 'var(--text-2)',
                border: '1px solid var(--border)', borderRadius: 5,
                padding: '5px 12px', fontSize: 12, cursor: 'pointer',
              }}>转换类型…</button>
              <button style={{
                background: 'transparent', color: 'oklch(0.65 0.10 55)',
                border: '1px solid oklch(0.38 0.10 55)', borderRadius: 5,
                padding: '5px 12px', fontSize: 12, cursor: 'pointer',
              }}>移回原位</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Clutter Section ──────────────────────────────────────
function ClutterSection({ onSelectNode }) {
  const [organized, setOrganized] = useCPSt({});
  const clutterNodes = NODES.filter(n => n.clutterFiles?.length > 0);

  return (
    <div>
      <div style={{ padding: '0 16px 12px', fontSize: 12.5, color: 'var(--text-3)', lineHeight: 1.6 }}>
        以下 L1/L2 节点内存在白名单外的文件（L1/L2 仅允许 .node/ + README.md + AGENTS.md + 下级节点目录）。
        点击「整理」后，文件将移至该层下的「其他」L3 节点。
      </div>
      <div style={{ padding: '6px 12px 10px', background: 'oklch(0.18 0.04 240)', borderRadius: 6, margin: '0 12px 12px', border: '1px solid var(--border)', fontSize: 12, color: 'var(--text-3)' }}>
        <span style={{ color: 'var(--accent)', fontWeight: 600 }}>ADR-008 乙方案：</span> 系统绝不自动移动——落下「整理键」的必须是你。
        可在设置中开启「自动整理」（用户授权的自动化）。
      </div>
      {clutterNodes.map(node => {
        const tpl = getTemplate(node.templateId);
        const isOrganized = organized[node.id];
        return (
          <div key={node.id} style={{
            margin: '0 12px 10px',
            background: 'var(--surface)', border: '1px solid ' + (isOrganized ? 'var(--border)' : 'oklch(0.38 0.12 55)'),
            borderRadius: 10, overflow: 'hidden', opacity: isOrganized ? 0.6 : 1,
          }}>
            <div style={{
              padding: '12px 16px',
              background: isOrganized ? 'var(--surface-2)' : 'oklch(0.18 0.06 55)',
              borderBottom: '1px solid ' + (isOrganized ? 'var(--border)' : 'oklch(0.30 0.08 55)'),
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 20, height: 20, borderRadius: 4, background: tpl?.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.9)',
                }}>{tpl?.glyph}</div>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-1)' }}>{node.name}</span>
                  <span style={{ marginLeft: 8, fontSize: 11.5, color: 'var(--text-3)' }}>L{node.level}</span>
                </div>
                {isOrganized ? (
                  <span style={{ fontSize: 11, color: 'oklch(0.65 0.12 145)', fontWeight: 600 }}>✓ 已整理</span>
                ) : (
                  <span style={{ fontSize: 11, color: 'oklch(0.72 0.13 55)', fontWeight: 600 }}>
                    {node.clutterFiles.length} 个待整理
                  </span>
                )}
              </div>
            </div>
            {!isOrganized && (
              <>
                <div style={{ padding: '10px 16px' }}>
                  {node.clutterFiles.map((s, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '5px 0', borderBottom: i < node.clutterFiles.length - 1 ? '1px solid var(--border)' : 'none',
                    }}>
                      <span style={{ color: 'var(--text-3)' }}
                        dangerouslySetInnerHTML={{ __html: getFileIcon(s.type) }} />
                      <span style={{ flex: 1, fontSize: 12.5, color: 'var(--text-1)' }}>{s.name}</span>
                      <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{s.size}</span>
                    </div>
                  ))}
                </div>
                <div style={{ padding: '8px 16px 12px', display: 'flex', gap: 8 }}>
                  <button onClick={() => setOrganized(o => ({ ...o, [node.id]: true }))} style={{
                    background: 'oklch(0.55 0.14 55)', color: '#000',
                    border: 'none', borderRadius: 5, padding: '6px 14px',
                    fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                  }}>整理 → 移入「其他」</button>
                  <button style={{
                    background: 'transparent', color: 'var(--text-2)',
                    border: '1px solid var(--border)', borderRadius: 5,
                    padding: '6px 12px', fontSize: 12, cursor: 'pointer',
                  }}>提升为节点</button>
                  <button onClick={() => onSelectNode(node.id)} style={{
                    background: 'transparent', color: 'var(--text-2)',
                    border: '1px solid var(--border)', borderRadius: 5,
                    padding: '6px 12px', fontSize: 12, cursor: 'pointer',
                  }}>查看节点</button>
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Orphan Section ───────────────────────────────────────
function OrphanSection({ onSelectNode }) {
  const orphans = NODES.filter(n => n.flags?.orphan);
  return (
    <div>
      <div style={{ padding: '0 16px 12px', fontSize: 12.5, color: 'var(--text-3)', lineHeight: 1.6 }}>
        以下节点的原父节点已不存在，恢复时被放置到工作区根。节点仍合法，字段和内容完好，
        需拖至合适的父节点归位。
      </div>
      {orphans.map(node => {
        const tpl = getTemplate(node.templateId);
        const schema = getSchema(node.templateId, node.level, node.schemaVersion);
        return (
          <div key={node.id} style={{
            margin: '0 12px 10px',
            background: 'var(--surface)', border: '1px solid oklch(0.32 0.08 290)',
            borderRadius: 10, overflow: 'hidden',
          }}>
            <div style={{ padding: '12px 16px', background: 'oklch(0.17 0.05 290)', borderBottom: '1px solid oklch(0.28 0.07 290)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 18, height: 18, borderRadius: 3, background: tpl?.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.9)',
                }}>{tpl?.glyph}</div>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-1)' }}>{node.name}</span>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: 'oklch(0.70 0.10 290)', fontWeight: 600, background: 'oklch(0.22 0.05 290)', padding: '2px 6px', borderRadius: 3 }}>◎ 孤儿</span>
              </div>
              <div style={{ marginTop: 6, fontSize: 12, color: 'oklch(0.58 0.07 290)' }}>
                原层级：L{node.flags?.originalLevel} · 原父 ID：{node.flags?.originalParentId || '—'}
              </div>
            </div>
            <div style={{ padding: '8px 16px 12px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button onClick={() => onSelectNode(node.id)} style={{
                background: 'var(--surface-2)', color: 'var(--text-1)',
                border: '1px solid var(--border)', borderRadius: 5,
                padding: '5px 12px', fontSize: 12, cursor: 'pointer',
              }}>查看节点</button>
              <button style={{
                background: 'transparent', color: 'var(--text-2)',
                border: '1px solid var(--border)', borderRadius: 5,
                padding: '5px 12px', fontSize: 12, cursor: 'pointer',
              }}>拖至目标父节点</button>
            </div>
          </div>
        );
      })}
      {orphans.length === 0 && (
        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-3)', fontSize: 12.5 }}>无孤儿节点</div>
      )}
    </div>
  );
}

// ─── Disconnected Section（失联节点，纯运行时软态，不持久化）─
function DisconnectedSection() {
  return (
    <div style={{ padding: '0 16px 20px' }}>
      <div style={{ fontSize: 12.5, color: 'var(--text-3)', lineHeight: 1.6, marginBottom: 16 }}>
        外部删除了节点的 .node/ 目录，导致身份丢失。EIDON 已在内存中标记为失联，不会自动清理。
        <div style={{ marginTop: 6, color: 'oklch(0.55 0.06 240)' }}>
          注意：失联是<strong>纯运行时软态</strong>（技术架构 §9.5 / D-4）——重建索引或重启即消失，不持久化。
        </div>
      </div>
      <div style={{
        padding: '24px 20px', textAlign: 'center',
        border: '2px dashed var(--border)', borderRadius: 10,
        color: 'var(--text-3)', fontSize: 13,
      }}>
        <span style={{ fontSize: 24, display: 'block', marginBottom: 8 }}>✓</span>
        当前无失联节点
        <div style={{ fontSize: 12, marginTop: 4 }}>
          若 .node/ 被外部误删，重新打开工作区会按 AX-5 自动补全身份骨架（旧引用断裂可接受）。
        </div>
      </div>
    </div>
  );
}

// ─── Repair Section（待修复结构，如杂物归宿"其他"L3 不存在等）─
function RepairSection({ onSelectNode }) {
  // 示例：检测到 L1/L2 有杂物，但本层"其他"L3 尚未创建；或前三层目录系统文件缺失正在补全中。
  const items = [
    {
      id: 'rep-other-missing',
      title: 'L2「小样本学习」下杂物待整理，但本层「其他」L3 节点不存在',
      detail: '用户点击"整理"时系统会先创建「其他」L3 再移入；如需提前创建可点击下方按钮。',
      actions: ['创建「其他」L3', '查看杂物'],
    },
  ];
  return (
    <div>
      <div style={{ padding: '0 16px 12px', fontSize: 12.5, color: 'var(--text-3)', lineHeight: 1.6 }}>
        以下结构需要修复但不属于越界/杂物/孤儿/失联中的任何一类。第一步只保证可见可手动处理，
        不提供自动修复向导。
      </div>
      {items.map(it => (
        <div key={it.id} style={{
          margin: '0 12px 10px', background: 'var(--surface)',
          border: '1px solid oklch(0.32 0.06 195)', borderRadius: 10, overflow: 'hidden',
        }}>
          <div style={{
            padding: '12px 16px', background: 'oklch(0.17 0.04 195)',
            borderBottom: '1px solid oklch(0.28 0.06 195)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-1)', flex: 1 }}>{it.title}</span>
              <span style={{ fontSize: 11, color: 'oklch(0.68 0.10 195)', fontWeight: 600, background: 'oklch(0.22 0.05 195)', padding: '2px 6px', borderRadius: 3 }}>⛒ 待修复</span>
            </div>
            <div style={{ marginTop: 6, fontSize: 12, color: 'oklch(0.58 0.07 195)' }}>{it.detail}</div>
          </div>
          <div style={{ padding: '8px 16px 12px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {it.actions.map((a, i) => (
              <button key={i} style={{
                background: i === 0 ? 'var(--surface-2)' : 'transparent',
                color: i === 0 ? 'var(--text-1)' : 'var(--text-2)',
                border: '1px solid var(--border)', borderRadius: 5,
                padding: '5px 12px', fontSize: 12, cursor: 'pointer',
              }}>{a}</button>
            ))}
          </div>
        </div>
      ))}
      {items.length === 0 && (
        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-3)', fontSize: 12.5 }}>无待修复项</div>
      )}
    </div>
  );
}

// ─── Consistency Panel ────────────────────────────────────
function ConsistencyPanel({ onSelectNode }) {
  const [active, setActive] = useCPSt('outOfPlace');
  const issues = WorkspaceMeta.consistencyIssues;

  // 5 类异常入口（PRD §9.3 FR-SYNC-3）
  const sections = [
    { id: 'outOfPlace',   icon: '⬦', label: '越界节点',       count: issues.outOfPlace,   color: 'oklch(0.65 0.14 55)'  },
    { id: 'clutter',      icon: '📂', label: '待整理杂物',     count: issues.clutter,      color: 'oklch(0.65 0.14 55)'  },
    { id: 'orphan',       icon: '◎', label: '孤儿节点',       count: issues.orphan,       color: 'oklch(0.62 0.10 290)' },
    { id: 'disconnected', icon: '⬚', label: '失联节点（运行时）', count: issues.disconnected, color: 'var(--text-3)' },
    { id: 'repair',       icon: '⛒', label: '待修复结构',     count: issues.repair,       color: 'oklch(0.68 0.10 195)' },
  ];

  const total = Object.values(issues).reduce((a, b) => a + b, 0);

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0 }}>
      {/* Left sidebar */}
      <div style={{
        width: 200, borderRight: '1px solid var(--border)',
        padding: '16px 8px', display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0,
      }}>
        <div style={{ padding: '4px 8px 12px', fontSize: 11.5, color: 'var(--text-3)', fontWeight: 600 }}>
          {total > 0 ? `${total} 项需处理` : '✓ 工作区整洁'}
        </div>
        {sections.map(s => (
          <SectionHeader key={s.id} {...s} active={active === s.id} onClick={() => setActive(s.id)} />
        ))}
        <div style={{ flex: 1 }} />
        <div style={{ padding: '12px 8px', fontSize: 11, color: 'var(--text-3)', borderTop: '1px solid var(--border)', lineHeight: 1.6 }}>
          扫描：{WorkspaceMeta.lastScannedAt}<br />
          「手动刷新」重新扫描
        </div>
        <button style={{
          margin: '0 4px 4px', background: 'var(--surface-2)',
          border: '1px solid var(--border)', borderRadius: 6,
          color: 'var(--text-2)', fontSize: 12, padding: '6px',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
        }}>
          <span dangerouslySetInnerHTML={{ __html: EidonIcons.refresh }} />
          手动刷新
        </button>
      </div>

      {/* Right content */}
      <div style={{ flex: 1, overflowY: 'auto', paddingTop: 16 }}>
        {active === 'outOfPlace'   && <OutOfPlaceSection onSelectNode={onSelectNode} />}
        {active === 'clutter'      && <ClutterSection onSelectNode={onSelectNode} />}
        {active === 'orphan'       && <OrphanSection onSelectNode={onSelectNode} />}
        {active === 'disconnected' && <DisconnectedSection />}
        {active === 'repair'       && <RepairSection onSelectNode={onSelectNode} />}
      </div>
    </div>
  );
}

Object.assign(window, { ConsistencyPanel });
