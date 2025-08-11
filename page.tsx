import DungeonCrawler from "@/components/dungeon-crawler"

export default function Home() {
  return (
    <main className="container mx-auto p-4">
      <h1 className="text-3xl font-bold text-center my-6">Screen Reader Dungeon Crawler</h1>
      <DungeonCrawler />
    </main>
  )
}
