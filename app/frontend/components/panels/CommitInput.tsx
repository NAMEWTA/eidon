/**
 * CommitInput.tsx — 「失焦/回车提交」受控输入。
 *
 * 受控输入语义（`value` + `onChange`）：
 *  - 编辑期自由输入（本地草稿，不每键写 store）；
 *  - blur 或按 Enter 时才提交（onCommit）；
 *  - 外部值变化时回同步草稿（含 store 钳制后的回写、后端规范化后的刷新）。
 *
 * 之所以需要本地草稿：受控 `value` 若直接绑 store 又无逐键 onChange，React 会把输入框变成只读；
 * 而纯 `defaultValue`（非受控）则无法反映钳制/外部刷新——二者都不等价于受控的 `value`+`onChange`。
 */
import { useEffect, useState } from 'react';

type NativeInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'defaultValue'
>;

interface CommitInputProps extends NativeInputProps {
  value: string | number;
  onCommit: (value: string) => void;
}

export function CommitInput({ value, onCommit, onBlur, onKeyDown, ...rest }: CommitInputProps) {
  const [draft, setDraft] = useState(String(value));
  // 仅当外部值真正变化时回同步：编辑途中 store 未变，effect 不触发，草稿得以保留（受控语义）。
  useEffect(() => {
    setDraft(String(value));
  }, [value]);
  return (
    <input
      {...rest}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={(e) => {
        onCommit(e.target.value);
        onBlur?.(e);
      }}
      onKeyDown={(e) => {
        // Enter 提交：原生 change 事件在单行输入按 Enter 时也会触发，这里以 blur 复刻
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        onKeyDown?.(e);
      }}
    />
  );
}

export default CommitInput;
