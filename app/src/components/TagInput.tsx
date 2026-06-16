/**
 * TagInput.tsx — 标签 chip 输入框（属性面板 frontmatter tags 编辑）。
 *
 * 已选标签渲染为「圈住」chip（可点 × 删除）；输入框按 空格 / 逗号 / Enter 提交一个 chip，
 * 空输入时 Backspace 删除最后一个；下拉用 lib/tags.rankTags 对工作区全部标签做模糊匹配，
 * 候选数据源为 workspaceIndex.tags（与编辑器 #tag 补全同源）。
 */
import { useMemo, useState } from 'react';

import { Icon } from './Icons';
import { useWorkspaceIndexStore } from '../stores/workspaceIndex';
import { rankTags } from '../lib/tags';

export function TagInput({
  value,
  onChange,
  placeholder,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}) {
  const allTags = useWorkspaceIndexStore((s) => s.tags);
  const [input, setInput] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);

  const suggestions = useMemo(() => {
    const taken = new Set(value.map((t) => t.toLowerCase()));
    return rankTags(input, allTags)
      .filter((t) => !taken.has(t.tag.toLowerCase()))
      .slice(0, 8);
  }, [input, allTags, value]);

  function addTag(raw: string) {
    const tag = raw.trim().replace(/^#+/, '').trim();
    if (!tag) return;
    if (!value.some((v) => v.toLowerCase() === tag.toLowerCase())) onChange([...value, tag]);
    setInput('');
    setActiveIdx(0);
  }

  function removeTag(idx: number) {
    onChange(value.filter((_, i) => i !== idx));
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (open && suggestions[activeIdx]) addTag(suggestions[activeIdx].tag);
      else if (input.trim()) addTag(input);
      return;
    }
    if (e.key === ' ' || e.key === ',' || e.key === '，') {
      if (input.trim()) {
        e.preventDefault();
        addTag(input);
      }
      return;
    }
    if (e.key === 'Backspace' && !input && value.length) {
      e.preventDefault();
      removeTag(value.length - 1);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div className="tag-input">
      <div className="tag-input__box">
        {value.map((tag, i) => (
          <span key={tag} className="tag-input__chip">
            #{tag}
            <button
              type="button"
              className="tag-input__chip-x"
              onClick={() => removeTag(i)}
              aria-label={`remove ${tag}`}
            >
              <Icon name="close" size={10} />
            </button>
          </span>
        ))}
        <input
          className="tag-input__field"
          value={input}
          placeholder={value.length ? '' : placeholder}
          spellCheck={false}
          onChange={(e) => {
            setInput(e.target.value);
            setOpen(true);
            setActiveIdx(0);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            if (input.trim()) addTag(input);
            setTimeout(() => setOpen(false), 120);
          }}
          onKeyDown={onKeyDown}
        />
      </div>
      {open && suggestions.length > 0 && (
        <ul className="tag-input__menu">
          {suggestions.map((s, i) => (
            <li key={s.tag}>
              <button
                type="button"
                className={`tag-input__opt${i === activeIdx ? ' tag-input__opt--active' : ''}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  addTag(s.tag);
                }}
                onMouseEnter={() => setActiveIdx(i)}
              >
                <span className="tag-input__opt-name">#{s.tag}</span>
                <span className="tag-input__opt-count">{s.count}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default TagInput;
