import { marketingContainer } from "@/components/marketing/marketing-chrome";
import { SectionHeading } from "./section-heading";
import { PRODUCTS } from "./product-panels";

/**
 * Four bays in one rack. Each surface is a full-width plate on the ruled grid
 * with its capabilities as ruled label cells, which is how the board itself
 * reads: no card grid, no label floated above a heading, no pills.
 */
function ProductStory() {
  return (
    <section id="product" aria-labelledby="product-heading" className="seam-t py-20 sm:py-28">
      <div className={marketingContainer}>
        <SectionHeading
          id="product-heading"
          title="Four surfaces. One board."
          lede="Everything shares one workspace, one set of permissions and one record of what happened."
        />

        <div className="border-rack-edge mt-12 border-t">
          {PRODUCTS.map((product) => {
            const Icon = product.icon;
            return (
              <article
                key={product.key}
                className="border-rack-edge grid items-start gap-x-10 gap-y-4 border-b py-8 md:grid-cols-[20rem_minmax(0,1fr)]"
              >
                <h3 className="type-h1 text-rack-foreground flex items-center gap-3">
                  <Icon className="text-primary size-5 shrink-0" aria-hidden />
                  {product.title}
                </h3>

                <div className="min-w-0">
                  <p className="type-body text-rack-muted-foreground max-w-[68ch] text-pretty">
                    {product.body}
                  </p>
                  <dl className="border-rack-edge mt-5 grid border-t sm:grid-cols-3">
                    {product.tags.map((tag) => (
                      <div key={tag} className="border-rack-edge border-b py-2.5 sm:border-b-0">
                        <dt className="sr-only">Capability</dt>
                        <dd className="type-meta text-rack-foreground">{tag}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export { ProductStory };
