import * as React from 'react'

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar'
import { getRecentJobs, getRecentSearchedGenes, getFavorites } from '@/actions'
import Link from 'next/link'
import { Badge } from './ui/badge'

export async function AppSidebar({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  const searchedGenes = await getRecentSearchedGenes({ userId: 'abcd1234' })
  const jobs = await getRecentJobs({ userId: 'abcd1234' })
  const favoriteGenes = await getFavorites({ userId: 'abcd1234' })

  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <span className="ml-2 mt-2 font-mono text-lg font-semibold">
          RNA End Joining
        </span>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Recent searches</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {searchedGenes.length > 0 ? (
                searchedGenes.map((gene) => (
                  <SidebarMenuItem key={gene.id}>
                    <SidebarMenuButton asChild>
                      <Link href={`/genes/${gene.symbol}`}>
                        <Badge
                          variant="outline"
                          className="inline-block w-16 truncate text-center font-mono"
                        >
                          {gene.symbol}
                        </Badge>
                        <span className="text-xs">{gene.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))
              ) : (
                <div className="p-4 text-sm text-gray-500">
                  No recent searches
                </div>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {jobs.length > 0 ? (
          <SidebarGroup>
            <SidebarGroupLabel>Recent jobs</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {jobs.map((job) => (
                  <SidebarMenuItem key={job.id}>
                    <SidebarMenuButton asChild>
                      <Link href={`/jobs/${job.id}`}>
                        <Badge
                          variant="outline"
                          className="inline-block w-16 truncate text-center font-mono"
                        >
                          {job.name}
                        </Badge>
                        <span className="text-xs">{job.sequence}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}
        {favoriteGenes.length > 0 ? (
          <SidebarGroup>
            <SidebarGroupLabel>Favorites</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {favoriteGenes.map((gene) => (
                  <SidebarMenuItem key={gene.id}>
                    <SidebarMenuButton asChild>
                      <Link href={`/genes/${gene.symbol}`}>
                        <Badge
                          variant="outline"
                          className="inline-block w-16 truncate text-center font-mono"
                        >
                          {gene.symbol}
                        </Badge>
                        <span className="text-xs">{gene.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
