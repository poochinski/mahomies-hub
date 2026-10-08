export default function ComingSoon({ title, blurb, phase }) {
  return (
    <section className="page">
      <div className="hero">
        <div className="eyebrow">{phase ? `COMING IN PHASE ${phase}` : "MAHOMIE'S HUB"}</div>
        <h1>{title}</h1>
        <p className="hero-copy">{blurb}</p>
      </div>
    </section>
  );
}
