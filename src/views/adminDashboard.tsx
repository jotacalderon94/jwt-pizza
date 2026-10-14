
import React from 'react';
import View from './view';
import { useNavigate } from 'react-router-dom';
import NotFound from './notFound';
import Button from '../components/button';
import { pizzaService } from '../service/service';
import { Franchise, FranchiseList, Role, Store, User, UserList } from '../service/pizzaService';
import { TrashIcon } from '../icons';

interface Props {
  user: User | null;
}

export default function AdminDashboard(props: Props) {
  const navigate = useNavigate();

  const [franchiseList, setFranchiseList] = React.useState<FranchiseList>({
    franchises: [],
    more: false,
  });
  const [franchisePage, setFranchisePage] = React.useState(0);
  const filterFranchiseRef = React.useRef<HTMLInputElement>(null);

  const [userList, setUserList] = React.useState<UserList>({
    users: [],
    more: false,
  });
  const [userPage, setUserPage] = React.useState(1);
  const [userFilter, setUserFilter] = React.useState('*');
  const [userError, setUserError] = React.useState('');

  React.useEffect(() => {
    (async () => {
      setFranchiseList(await pizzaService.getFranchises(franchisePage, 3, '*'));
    })();
  }, [props.user, franchisePage]);

  React.useEffect(() => {
    if (!Role.isRole(props.user, Role.Admin)) return;

    let active = true;

    async function loadUsers() {
      try {
        const result = await pizzaService.getUsers(userPage, 10, userFilter);

        if (active) {
          setUserList(result);
          setUserError('');
        }
      } catch {
        if (active) {
          setUserList({ users: [], more: false });
          setUserError('Unable to load users.');
        }
      }
    }

    void loadUsers();

    return () => {
      active = false;
    };
  }, [props.user, userPage, userFilter]);

  function createFranchise() {
    navigate('/admin-dashboard/create-franchise');
  }

  async function closeFranchise(franchise: Franchise) {
    navigate('/admin-dashboard/close-franchise', {
      state: { franchise: franchise },
    });
  }

  async function closeStore(franchise: Franchise, store: Store) {
    navigate('/admin-dashboard/close-store', {
      state: { franchise: franchise, store: store },
    });
  }

  async function filterFranchises() {
    setFranchiseList(
      await pizzaService.getFranchises(
        franchisePage,
        10,
        `*${filterFranchiseRef.current?.value}*`
      )
    );
  }

  function filterUsers(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const name = String(formData.get('filterUser') ?? '').trim();

    setUserPage(1);
    setUserFilter(name ? `*${name}*` : '*');
  }

  async function deleteUser(user: User) {
  if (!user.id) return;

  const confirmed = window.confirm(
    `Are you sure you want to delete ${user.name || user.email}?`
  );

  if (!confirmed) return;

  try {
    await pizzaService.deleteUser(user.id);

    const updatedList = await pizzaService.getUsers(
      userPage,
      10,
      userFilter
    );

    setUserList(updatedList);
    setUserError('');
  } catch {
    setUserError('Unable to delete user.');
  }
}

  let response = <NotFound />;

  if (Role.isRole(props.user, Role.Admin)) {
    response = (
      <View title="Mama Ricci's kitchen">
        {/* Franchises */}
        <div className="text-start py-8 px-4 sm:px-6 lg:px-8">
          <h3 className="text-neutral-100 text-xl">Franchises</h3>

          <div className="bg-neutral-100 overflow-clip my-4">
            <div className="flex flex-col">
              <div className="-m-1.5 overflow-x-auto">
                <div className="p-1.5 min-w-full inline-block align-middle">
                  <div className="overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="uppercase text-neutral-100 bg-slate-400 border-b-2 border-gray-500">
                        <tr>
                          {['Franchise', 'Franchisee', 'Store', 'Revenue', 'Action'].map((header) => (
                            <th
                              key={header}
                              scope="col"
                              className="px-6 py-3 text-center text-xs font-medium"
                            >
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>

                      {franchiseList.franchises.map((franchise, findex) => (
                        <tbody key={findex} className="divide-y divide-gray-200">
                          <tr className="border-neutral-500 border-t-2">
                            <td className="text-start px-2 whitespace-nowrap text-l font-mono text-orange-600">
                              {franchise.name}
                            </td>

                            <td
                              className="text-start px-2 whitespace-nowrap text-sm font-normal text-gray-800"
                              colSpan={3}
                            >
                              {franchise.admins?.map((o) => o.name).join(', ')}
                            </td>

                            <td className="px-6 py-1 whitespace-nowrap text-end text-sm font-medium">
                              <button
                                type="button"
                                className="px-2 py-1 inline-flex items-center gap-x-2 text-sm font-semibold rounded-lg border border-1 border-orange-400 text-orange-400 hover:border-orange-800 hover:text-orange-800"
                                onClick={() => closeFranchise(franchise)}
                              >
                                <TrashIcon />
                                Close
                              </button>
                            </td>
                          </tr>

                          {franchise.stores.map((store, sindex) => (
                            <tr key={sindex} className="bg-neutral-100">
                              <td
                                className="text-end px-2 whitespace-nowrap text-sm text-gray-800"
                                colSpan={3}
                              >
                                {store.name}
                              </td>

                              <td className="text-end px-2 whitespace-nowrap text-sm text-gray-800">
                                {store.totalRevenue?.toLocaleString()} ₿
                              </td>

                              <td className="px-6 py-1 whitespace-nowrap text-end text-sm font-medium">
                                <button
                                  type="button"
                                  className="px-2 py-1 inline-flex items-center gap-x-2 text-sm font-semibold rounded-lg border border-1 border-orange-400 text-orange-400 hover:border-orange-800 hover:text-orange-800"
                                  onClick={() => closeStore(franchise, store)}
                                >
                                  <TrashIcon />
                                  Close
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      ))}

                      <tfoot>
                        <tr>
                          <td className="px-1 py-1">
                            <input
                              type="text"
                              ref={filterFranchiseRef}
                              name="filterFranchise"
                              placeholder="Filter franchises"
                              className="px-2 py-1 text-sm border border-gray-300 rounded-lg"
                            />

                            <button
                              type="submit"
                              className="ml-2 px-2 py-1 text-sm font-semibold rounded-lg border border-orange-400 text-orange-400 hover:border-orange-800 hover:text-orange-800"
                              onClick={filterFranchises}
                            >
                              Submit
                            </button>
                          </td>

                          <td colSpan={4} className="text-end text-sm font-medium">
                            <button
                              className="w-12 p-1 text-sm font-semibold rounded-lg border border-transparent bg-white text-grey border-grey m-1 hover:bg-orange-200 disabled:bg-neutral-300"
                              onClick={() => setFranchisePage(franchisePage - 1)}
                              disabled={franchisePage <= 0}
                            >
                              «
                            </button>

                            <button
                              className="w-12 p-1 text-sm font-semibold rounded-lg border border-transparent bg-white text-grey border-grey m-1 hover:bg-orange-200 disabled:bg-neutral-300"
                              onClick={() => setFranchisePage(franchisePage + 1)}
                              disabled={!franchiseList.more}
                            >
                              »
                            </button>
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div>
          <Button
            className="w-36 text-xs sm:text-sm sm:w-64"
            title="Add Franchise"
            onPress={createFranchise}
          />
        </div>

        {/* Users */}
        <section className="text-start py-8 px-4 sm:px-6 lg:px-8">
          <h3 className="text-neutral-100 text-xl">Users</h3>

          <div className="bg-neutral-100 my-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="uppercase text-neutral-100 bg-slate-400">
                <tr>
                  {['Name', 'Email', 'Roles', 'Action'].map((header) => (
                    <th
                      key={header}
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-200">
                {userList.users.map((user) => (

<tr key={user.id}>
  <td className="px-6 py-3 text-sm text-gray-800">
    {user.name}
  </td>

  <td className="px-6 py-3 text-sm text-gray-800">
    {user.email}
  </td>

  <td className="px-6 py-3 text-sm text-gray-800">
    {user.roles?.map((role) => role.role).join(', ') || 'None'}
  </td>

  <td className="px-6 py-3 text-sm">
    <button
      type="button"
      aria-label={`Delete ${user.name}`}
      onClick={() => deleteUser(user)}
      disabled={user.id === props.user?.id}
      className="inline-flex items-center gap-2 rounded-lg border border-red-500 px-3 py-1 text-red-600 hover:bg-red-50 disabled:opacity-40"
    >
      <TrashIcon />
      Delete
    </button>
  </td>
</tr>

                ))}
              </tbody>
            </table>

            {userError && (
              <p role="alert" className="px-6 py-3 text-sm text-red-600">
                {userError}
              </p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 p-3">
              <form onSubmit={filterUsers} className="flex gap-2">
                <input
                  type="text"
                  name="filterUser"
                  aria-label="Filter users by name"
                  placeholder="Filter users"
                  className="px-2 py-1 text-sm border border-gray-300 rounded-lg"
                />

                <button
                  type="submit"
                  className="px-3 py-1 text-sm rounded-lg border border-orange-400 text-orange-600"
                >
                  Submit
                </button>
              </form>

              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-700">
                  Page {userPage}
                </span>

                <button
                  type="button"
                  aria-label="Previous users page"
                  disabled={userPage <= 1}
                  onClick={() => setUserPage((page) => page - 1)}
                  className="px-3 py-1 rounded bg-white disabled:bg-neutral-300"
                >
                  «
                </button>

                <button
                  type="button"
                  aria-label="Next users page"
                  disabled={!userList.more}
                  onClick={() => setUserPage((page) => page + 1)}
                  className="px-3 py-1 rounded bg-white disabled:bg-neutral-300"
                >
                  »
                </button>
              </div>
            </div>
          </div>
        </section>
      </View>
    );
  }

  return response;
}
