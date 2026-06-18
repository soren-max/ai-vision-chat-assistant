import type { VisionContext } from '../App';

interface Props {
  vision: VisionContext;
}

export default function VisionDrawer({ vision }: Props) {
  const hasVision = vision.source === 'camera' && Boolean(vision.updatedAt);

  return (
    <div className="p-4 space-y-4">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Vision Analysis</h3>
      <div className="space-y-3">
        <div>
          <span className="text-[10px] text-gray-500">Scene Summary</span>
          <p className="text-sm mt-1">
            {hasVision ? (vision.summary || vision.scene || '已获取画面，但模型没有返回摘要。') : '启动摄像头后会在这里显示最新画面理解。'}
          </p>
          {vision.updatedAt && (
            <p className="text-[10px] text-gray-500 mt-1">
              updated {new Date(vision.updatedAt).toLocaleTimeString()}
            </p>
          )}
        </div>
        <div>
          <span className="text-[10px] text-gray-500">Detected Objects</span>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {vision.objects.length > 0 ? vision.objects.map(o => (
              <span key={`${o.name}-${o.position || ''}`} className="px-2 py-1 text-[11px] rounded-md bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 font-mono">
                {o.name} {Math.round(o.confidence * 100)}%
              </span>
            )) : (
              <span className="text-[11px] text-gray-400">No objects yet</span>
            )}
          </div>
        </div>
        {vision.screen_content && (
          <div>
            <span className="text-[10px] text-gray-500">Screen Content</span>
            <p className="text-sm mt-1">{vision.screen_content}</p>
          </div>
        )}
        {vision.risk_content.length > 0 && (
          <div>
            <span className="text-[10px] text-gray-500">Risk Signals</span>
            <div className="text-[11px] text-red-400 mt-1 space-y-1">
              {vision.risk_content.map(item => <div key={item}>{item}</div>)}
            </div>
          </div>
        )}
        <div>
          <span className="text-[10px] text-gray-500">Cost Control</span>
          <div className="text-[11px] text-gray-400 mt-1 space-y-1">
            <div className="flex gap-2"><span className="w-1 h-1 rounded-full bg-green-500 mt-1.5 shrink-0" /> 自动分析间隔 8 秒</div>
            <div className="flex gap-2"><span className="w-1 h-1 rounded-full bg-gray-400 mt-1.5 shrink-0" /> 对话复用最近一次视觉结果</div>
            <div className="flex gap-2"><span className="w-1 h-1 rounded-full bg-gray-400 mt-1.5 shrink-0" /> 用户可手动刷新关键帧</div>
          </div>
        </div>
      </div>
    </div>
  );
}
