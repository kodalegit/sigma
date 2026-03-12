import { Suspense } from "react";
import { HoroApp } from "@/components/horo-app";

export default function Home() {
  return (
    <Suspense>
      <HoroApp />
    </Suspense>
  );
}
