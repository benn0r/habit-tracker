import { redirect } from "next/navigation";
import { getUserId } from "@/lib/auth";
import Dashboard from "./Dashboard";

export default async function AppPage() {
  if (!(await getUserId())) redirect("/");
  return <Dashboard />;
}
