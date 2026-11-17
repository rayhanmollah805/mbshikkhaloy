import { Suspense } from "react";
import Form from "./form";

export default function Page() {
  // useSearchParams (for ?next=) must sit under Suspense.
  return (
    <Suspense>
      <Form />
    </Suspense>
  );
}
