/**
 * AboutDialog.tsx — 关于对话框。
 * 受控（open/onClose）；显示版本、品牌、链接。技术栈脚注 React 19。
 */
import { useEffect, useState } from 'react';
import { Icon } from '../shared/Icons';
import { getVersion } from '@bridge/ipc/platform';
import { openUrl } from '@bridge/ipc/opener';

const links = {
  website: 'https://github.com/NAMEWTA/eidon',
  github: 'https://github.com/NAMEWTA/eidon',
  releases: 'https://github.com/NAMEWTA/eidon/releases',
  sponsor: 'https://github.com/sponsors/NAMEWTA',
};

async function visit(url: string) {
  try {
    await openUrl(url);
  } catch (e) {
    console.error('failed to open url', e);
  }
}

export function AboutDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [version, setVersion] = useState('…');
  useEffect(() => {
    if (!open) return;
    getVersion()
      .then((v) => setVersion(v))
      .catch(() => setVersion('2.5.0'));
  }, [open]);

  if (!open) return null;
  return (
    <div className="about__backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="about" role="dialog" aria-label="About EIDON">
        <button className="about__close" onClick={onClose} aria-label="Close"><Icon name="close" size={18} /></button>
        <div className="about__brand">
          {/* 品牌标识：像素宠物「知识种子」首帧（scripts/generate-brand-icon.mjs 生成） */}
          <img className="brand-logo" src="/eidon-pet.png" alt="EIDON" draggable={false} />
        </div>
        <h2 className="about__name">EIDON</h2>
        <div className="about__version">v{version}</div>
        <p className="about__tagline">
          Local-first structured knowledge IDE.<br />
          <span className="about__tagline-zh">本地优先的结构化知识 IDE。</span>
        </p>
        <p className="about__desc">
          Markdown files, fixed L1/L2/L3 nodes, versioned templates.<br />
          <span className="about__desc-zh">Markdown 文件、固定 L1/L2/L3 节点、版本化模板。</span>
        </p>
        <div className="about__links">
          <button className="about__link" onClick={() => visit(links.website)}>
            <span className="about__link-icon"><Icon name="globe" size={14} /></span>
            <div>
              <div className="about__link-title">Website / 官网</div>
              <div className="about__link-url">NAMEWTA/eidon</div>
            </div>
          </button>
          <button className="about__link" onClick={() => visit(links.github)}>
            <span className="about__link-icon"><Icon name="star" size={14} /></span>
            <div>
              <div className="about__link-title">GitHub</div>
              <div className="about__link-url">NAMEWTA/eidon</div>
            </div>
          </button>
          <button className="about__link" onClick={() => visit(links.releases)}>
            <span className="about__link-icon"><Icon name="package" size={14} /></span>
            <div>
              <div className="about__link-title">Releases / 历史版本</div>
              <div className="about__link-url">github.com/.../releases</div>
            </div>
          </button>
          <button className="about__link" onClick={() => visit(links.sponsor)}>
            <span className="about__link-icon"><Icon name="heart" size={14} /></span>
            <div>
              <div className="about__link-title">Sponsor / 赞助</div>
              <div className="about__link-url">GitHub · Alipay · WeChat</div>
            </div>
          </button>
        </div>
        <div className="about__footer">
          © 2026 xiangdong li · MIT License<br />
          Electron · React 19 · CodeMirror 6 · TypeScript
        </div>
      </div>
    </div>
  );
}

export default AboutDialog;
