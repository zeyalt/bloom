import { Suspense } from "react";
import { MyDayView } from "@/components/my-day/MyDayView";

// Suspense: MyDayView reads ?from=bloom, which needs a boundary for the static build.
export default function Page() {
  return (
    <Suspense>
      <MyDayView />
    </Suspense>
  );
}
