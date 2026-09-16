import Link from 'next/link';
import { getStats } from '@/lib/usage';
import styles from './stats.module.css';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Kromata Lab · Usage' };

function score(value: number | null) {
  if (value === null) return <span className={styles.mono}>—</span>;
  const pct = Math.round(value * 100);
  return <span className={pct >= 0 ? styles.pos : styles.neg}>{pct > 0 ? `+${pct}` : pct}%</span>;
}

export default async function StatsPage() {
  const stats = await getStats();
  const { totals } = stats;

  return (
    <div className={styles.page}>
      <div className={styles.head}>
        <h1 className={styles.title}>Usage</h1>
        <Link href="/">← Back to the Lab</Link>
      </div>
      <p className={styles.sub}>
        From <code>data/usage.jsonl</code>. Previews are the renders the controls fire while someone
        is trying settings; downloads are the ones someone kept. The second number is the one worth
        watching.{' '}
        <a href="/api/stats">JSON</a>
      </p>

      {totals.conversions === 0 ? (
        <p className={styles.empty}>Nothing recorded yet. Convert an image and come back.</p>
      ) : (
        <>
          <div className={styles.cards}>
            {[
              ['Conversions', totals.conversions],
              ['Downloads', totals.downloads],
              ['Previews', totals.previews],
              ['Sessions', totals.sessions],
              ['Ratings', totals.ratings],
              ['Median ms', stats.timing.medianMs ?? 0],
              ['p95 ms', stats.timing.p95Ms ?? 0],
            ].map(([label, value]) => (
              <div key={String(label)} className={styles.card}>
                <div className={styles.cardValue}>{value}</div>
                <div className={styles.cardLabel}>{label}</div>
              </div>
            ))}
            <div className={styles.card}>
              <div className={styles.cardValue}>{score(stats.rating.average)}</div>
              <div className={styles.cardLabel}>
                Avg rating ({stats.rating.up}↑ {stats.rating.down}↓)
              </div>
            </div>
          </div>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Per day</h2>
            <div className={styles.scroll}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th className={styles.num}>Conversions</th>
                    <th className={styles.num}>Downloads</th>
                    <th className={styles.num}>Sessions</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.perDay.map((d) => (
                    <tr key={d.date}>
                      <td>{d.date}</td>
                      <td className={styles.num}>{d.conversions}</td>
                      <td className={styles.num}>{d.downloads}</td>
                      <td className={styles.num}>{d.sessions}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Per palette</h2>
            <div className={styles.scroll}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Palette</th>
                    <th className={styles.num}>Conversions</th>
                    <th className={styles.num}>Downloads</th>
                    <th className={styles.num}>Ratings</th>
                    <th className={styles.num}>Score</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.perPalette.map((p) => (
                    <tr key={p.palette}>
                      <td>{p.palette}</td>
                      <td className={styles.num}>{p.conversions}</td>
                      <td className={styles.num}>{p.downloads}</td>
                      <td className={styles.num}>{p.ratings}</td>
                      <td className={styles.num}>{score(p.avgRating)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Per session</h2>
            <div className={styles.scroll}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Session</th>
                    <th className={styles.num}>Conversions</th>
                    <th className={styles.num}>Downloads</th>
                    <th className={styles.num}>Days active</th>
                    <th>Last seen</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.perSession.map((s) => (
                    <tr key={s.session}>
                      <td className={styles.mono}>{s.session.slice(0, 8)}</td>
                      <td className={styles.num}>{s.conversions}</td>
                      <td className={styles.num}>{s.downloads}</td>
                      <td className={styles.num}>{s.days}</td>
                      <td className={styles.mono}>{s.lastSeen.replace('T', ' ').slice(0, 16)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Per mode</h2>
            <div className={styles.scroll}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Mode</th>
                    <th className={styles.num}>Conversions</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.perMode.map((m) => (
                    <tr key={m.mode}>
                      <td>{m.mode}</td>
                      <td className={styles.num}>{m.conversions}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
