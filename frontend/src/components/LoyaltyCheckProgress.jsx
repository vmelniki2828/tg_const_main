import React from 'react';

const states = { running: 'Проверка идет', completed: 'Проверка завершена', failed: 'Проверка остановлена из-за ошибки',
  interrupted: 'Проверка прервана', cancelled: 'Проверка остановлена' };
const reasons = { not_started: 'Участие еще не начато', not_due: 'Срок награды еще не наступил или период отключен',
  not_subscribed: 'Не подписаны на канал', disabled: 'Программа отключена' };

export default function LoyaltyCheckProgress({ job, automatic, onCancel }) {
  return <div aria-live="polite" style={{ margin: '12px 0', padding: 12, background: '#eef6fb', borderRadius: 8 }}>
    {job && <section aria-label="Принудительная проверка">
      <strong>{states[job.status] || job.status}</strong>
      <div>Проверено: {job.checked} из {job.total}</div>
      <progress aria-label="Прогресс проверки" value={job.checked} max={Math.max(1, job.total)} style={{ width: '100%' }} />
      {job.status === 'running' && <div>Проверка работает в фоне. Это окно можно закрыть и вернуться позже.</div>}
      <div>Выдано новых ваучеров: {job.issued}. Уже выдано: {job.alreadyIssued}. Ошибок: {job.errorCount}.</div>
      <div>Не хватает ваучеров для наград: {job.noStock}. После пополнения можно повторить проверку.</div>
      {Object.entries(job.skipped || {}).map(([reason, count]) => <div key={reason}>{reasons[reason] || reason}: {count}</div>)}
      {job.error && <div role="alert">{job.error}</div>}
      {job.status === 'running' && <button type="button" onClick={onCancel} disabled={job.cancelRequested}>
        {job.cancelRequested ? 'Останавливаем после текущей группы…' : 'Остановить проверку'}
      </button>}
    </section>}
    {automatic && <section aria-label="Автоматическая проверка" style={{ marginTop: job ? 12 : 0 }}>
      Автоматический цикл: {automatic.checked} из {automatic.total} проверено
      {automatic.status === 'running' ? ' — идет проверка' : automatic.status === 'completed' ? ' — цикл завершен' : ''}.
      {' '}Ошибок: {automatic.errors || 0}.
    </section>}
    {!job && !automatic && <span>Проверка еще не запускалась.</span>}
  </div>;
}
