import { Provider } from '@/context/context'
import GeneSplitterList from './gene-splitter-list'
import GeneSplitterInput from './gene-splitter-input'

export default function Home() {
  return (
    <Provider>
      <div className="container py-4 md:py-8 px-4 grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        <aside className="">
          <GeneSplitterInput />
        </aside>
        <main className="xl:col-span-2">
          <div className="max-h-[75vh] overflow-auto">
            <GeneSplitterList />
          </div>
        </main>
      </div>
    </Provider>
  )
}
