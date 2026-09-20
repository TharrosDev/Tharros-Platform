import { cn } from "@/lib/utils";
import { marketingContainer } from "@/components/marketing/marketing-chrome";
import { SectionHeading } from "./section-heading";
import { PRODUCTS } from "./product-panels";

/**
 * Four bays in one rack. Each surface gets a plate of stock seated in the
 * chrome, so the page reads the way the product does.
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

        <div className="mt-12 grid gap-px sm:grid-cols-2">
          {PRODUCTS.map((product) => {
            const Icon = product.icon;
            return (
              <article
                key={product.key}
                className="on-stock bg-card border-border flex min-w-0 flex-col border p-6 sm:p-8"
              >
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden
                    className="border-input bg-surface-2 text-foreground flex size-8 shrink-0 items-center justify-center border"
                  >
                    <Icon className="size-4" />
                  </span>
                  <p className="type-meta text-muted-foreground">
                    {product.index} · {product.label}
                  </p>
                </div>

                <h3 className="type-h1 text-foreground mt-5">{product.title}</h3>
                <p className="type-body text-muted-foreground mt-3 text-pretty">{product.body}</p>

                <ul className="mt-6 flex flex-wrap gap-px pt-1">
                  {product.tags.map((tag) => (
                    <li
                      key={tag}
                      className={cn(
                        "border-input text-muted-foreground type-meta border px-2 py-1",
                      )}
                    >
                      {tag}
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export { ProductStory };
