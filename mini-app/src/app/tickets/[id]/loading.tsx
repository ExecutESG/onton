export default function TicketPassLoading() {
  return (
    <div className="min-h-screen bg-[#f0f0f0]">
      <div className="bg-white pb-4">
        <div className="mx-auto max-w-md px-4 pt-4">
          <div className="aspect-square w-full animate-pulse rounded-xl bg-gray-200" />
        </div>
        <div className="mx-auto max-w-md space-y-3 px-4 pt-4">
          <div className="flex justify-between">
            <div className="h-4 w-16 animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-28 animate-pulse rounded bg-gray-200" />
          </div>
          <div className="flex justify-between">
            <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-20 animate-pulse rounded bg-gray-200" />
          </div>
        </div>
      </div>
    </div>
  );
}
