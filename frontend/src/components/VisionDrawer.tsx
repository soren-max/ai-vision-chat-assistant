export default function VisionDrawer() {
  return (
    <div className="p-4 space-y-4">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Vision Analysis</h3>
      <div className="space-y-3">
        <div>
          <span className="text-[10px] text-gray-500">Scene Summary</span>
          <p className="text-sm mt-1">室内办公环境，光线充足。笔记本电脑位于桌面中央，右侧有咖啡杯和手机。</p>
        </div>
        <div>
          <span className="text-[10px] text-gray-500">Detected Objects</span>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {['Laptop 97%','Coffee Cup 89%','Keyboard 94%','Phone 82%'].map(o => (
              <span key={o} className="px-2 py-1 text-[11px] rounded-md bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 font-mono">{o}</span>
            ))}
          </div>
        </div>
        <div>
          <span className="text-[10px] text-gray-500">Recent History</span>
          <div className="text-[11px] text-gray-400 mt-1 space-y-1">
            <div className="flex gap-2"><span className="w-1 h-1 rounded-full bg-green-500 mt-1.5 shrink-0" /> Office scene — 4 objects detected</div>
            <div className="flex gap-2"><span className="w-1 h-1 rounded-full bg-gray-400 mt-1.5 shrink-0" /> Office scene — 3 objects detected</div>
            <div className="flex gap-2"><span className="w-1 h-1 rounded-full bg-gray-400 mt-1.5 shrink-0" /> Office scene — 4 objects detected</div>
          </div>
        </div>
      </div>
    </div>
  );
}
