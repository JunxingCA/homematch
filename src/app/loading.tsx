import { LoadingState } from "@/components/states/States";

export default function Loading() {
  return (
    <LoadingState
      frame="page"
      title="Opening HomeMatch"
      messages={["Switching the lights on…"]}
    />
  );
}
