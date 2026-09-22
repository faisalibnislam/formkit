import { PublicPage } from "@/components/site/PublicPage";

export default function Home() {
  return (
    <PublicPage current="product">
      <main id="fk-main" className="fk-main" style={{ padding: "160px 24px 80px" }}>
        <div className="fk-measure">
          <h1>Landing page — built in the next stage.</h1>
        </div>
      </main>
    </PublicPage>
  );
}
