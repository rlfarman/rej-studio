import { Provider } from '@/context/context'
import GeneSplitterList from './gene-splitter-list'
import GeneSplitterInput from './gene-splitter-input'

export default function Home() {
  return (
    <Provider>
      <div className="container py-4 md:py-8 px-4 grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        <aside className="">
          <GeneSplitterInput />
        </aside>
        <main className="">
          <div className="max-h-[75vh] overflow-auto lg:col-span-2">
            <GeneSplitterList />
          </div>
        </main>
      </div>
    </Provider>
  )
}
