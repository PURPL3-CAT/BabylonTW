const canvas = vm.runtime.renderer.canvas;
var objects = [];
var babylonScene = null;
var shadowGenerator;

const blocksIcon = "data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9Im5vIiA/Pgo8IURPQ1RZUEUgc3ZnIFBVQkxJQyAiLS8vVzNDLy9EVEQgU1ZHIDEuMS8vRU4iICJodHRwOi8vd3d3LnczLm9yZy9HcmFwaGljcy9TVkcvMS4xL0RURC9zdmcxMS5kdGQiPgo8c3ZnIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6eGxpbms9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiIHZlcnNpb249IjEuMSIgd2lkdGg9IjUxMS44NzYyNDYzMDczODM1IiBoZWlnaHQ9IjUxMS44NzYyNDYzMDczODM1IiB2aWV3Qm94PSIwLjU3ODI5NDY3NDg2ODIwMzYgMC41NzgyOTQ2NzQ4NjgyMDM2IDUxMS44NzYyNDYzMDczODM1IDUxMS44NzYyNDYzMDczODM1IiB4bWw6c3BhY2U9InByZXNlcnZlIj4KPGRlc2M+Q3JlYXRlZCB3aXRoIEZhYnJpYy5qcyA1LjMuMDwvZGVzYz4KPGRlZnM+CjwvZGVmcz4KPGcgdHJhbnNmb3JtPSJtYXRyaXgoMS44NDc5Mjg2ODcgMCAwIDEuODQ3OTI4Njg3IDI1Ni41MTY0MTc4Mjg2IDI1Ni41MTY0MTc4Mjg2KSIgaWQ9ImtJTWlFY19uZmtDZVdLNnhKTTdTcyIgID4KPHBhdGggc3R5bGU9InN0cm9rZTogbm9uZTsgc3Ryb2tlLXdpZHRoOiAwOyBzdHJva2UtZGFzaGFycmF5OiBub25lOyBzdHJva2UtbGluZWNhcDogYnV0dDsgc3Ryb2tlLWRhc2hvZmZzZXQ6IDA7IHN0cm9rZS1saW5lam9pbjogbWl0ZXI7IHN0cm9rZS1taXRlcmxpbWl0OiAxMDsgZmlsbDogcmdiKDIxMywyMDksMjAxKTsgZmlsbC1ydWxlOiBub256ZXJvOyBvcGFjaXR5OiAxOyIgdmVjdG9yLWVmZmVjdD0ibm9uLXNjYWxpbmctc3Ryb2tlIiAgdHJhbnNmb3JtPSIgdHJhbnNsYXRlKC0zMjAsIC0xODApIiBkPSJNIDE4MS41IDE4MCBDIDE4MS41IDEwMy41MDg1NiAyNDMuNTA4NTYgNDEuNSAzMjAgNDEuNSBDIDM5Ni40OTE0NCA0MS41IDQ1OC41IDEwMy41MDg1NiA0NTguNSAxODAgQyA0NTguNSAyNTYuNDkxNDQgMzk2LjQ5MTQ0IDMxOC41IDMyMCAzMTguNSBDIDI0My41MDg1NiAzMTguNSAxODEuNSAyNTYuNDkxNDQgMTgxLjUgMTgwIHoiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgLz4KPC9nPgo8ZyB0cmFuc2Zvcm09Im1hdHJpeCgxLjg0NzkyODY4NyAwIDAgMS44NDc5Mjg2ODcgMTk1LjgzNzgyMjIyMTYgMTIwLjYyOTUxMDA4NzQpIiBpZD0iT05aWUF3S3FpRjFIYVhXVnU1MnRZIiAgPgo8cGF0aCBzdHlsZT0ic3Ryb2tlOiBub25lOyBzdHJva2Utd2lkdGg6IDE7IHN0cm9rZS1kYXNoYXJyYXk6IG5vbmU7IHN0cm9rZS1saW5lY2FwOiBidXR0OyBzdHJva2UtZGFzaG9mZnNldDogMDsgc3Ryb2tlLWxpbmVqb2luOiBtaXRlcjsgc3Ryb2tlLW1pdGVybGltaXQ6IDEwOyBmaWxsOiByZ2IoMjI0LDEwNCw3Nik7IGZpbGwtcnVsZTogZXZlbm9kZDsgb3BhY2l0eTogMTsiIHZlY3Rvci1lZmZlY3Q9Im5vbi1zY2FsaW5nLXN0cm9rZSIgIHRyYW5zZm9ybT0iIHRyYW5zbGF0ZSgtMjg3LjE2Mzk5NSwgLTEwNi40NjUyODU4NjU4KSIgZD0iTSAzNDguMjg1OCA4Ny40MjM1OSBDIDMxNy4wMjc4OSAxMDUuNjE5OTggMjg1LjcwNzc2IDEyMy43NDE4ODAwMDAwMDAwMSAyNTQuMzI0NzcgMTQxLjc4OSBDIDI1NC4yMjAxMiAxNDEuNzg5IDI1NC4xMTUxNiAxNDEuNzg5IDI1NC4wMTA1MiAxNDEuNzg5IEMgMjQ0LjU0NDY1MDAwMDAwMDAyIDEzNi41NzQ5NSAyMzUuMjIxNzcwMDAwMDAwMDIgMTMxLjEyODA0IDIyNi4wNDIxOSAxMjUuNDQ3OTQ5OTk5OTk5OTkgQyAyNTcuMTMzMjMgMTA3LjM4NzAwOTk5OTk5OTk5IDI4OC4yNDQwNyA4OS4zMTc1Nzk5OTk5OTk5OSAzMTkuMzc0NzEgNzEuMjM5NjY5OTk5OTk5OTkgQyAzMjAuMDQ1NjQgNzEuMDQwMTE5OTk5OTk5OTkgMzIwLjY3NDEzOTk5OTk5OTk3IDcxLjE0NTA4IDMyMS4yNjAyMiA3MS41NTM5MTk5OTk5OTk5OSBDIDMzMC4zNDAxOSA3Ni43NzMgMzM5LjM0ODgyIDgyLjA2Mjc4OTk5OTk5OTk5IDM0OC4yODU4IDg3LjQyMzU4OTk5OTk5OTk5IHoiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgLz4KPC9nPgo8ZyB0cmFuc2Zvcm09Im1hdHJpeCgxLjg0NzkyODY4NyAwIDAgMS44NDc5Mjg2ODcgMjU2LjUyMjM0OTY3OTYgMTU1LjEyNzM4OTYyODEpIiBpZD0iVEtBSkxvMmVGa19JVEZCTUJQaGNaIiAgPgo8cGF0aCBzdHlsZT0ic3Ryb2tlOiBub25lOyBzdHJva2Utd2lkdGg6IDE7IHN0cm9rZS1kYXNoYXJyYXk6IG5vbmU7IHN0cm9rZS1saW5lY2FwOiBidXR0OyBzdHJva2UtZGFzaG9mZnNldDogMDsgc3Ryb2tlLWxpbmVqb2luOiBtaXRlcjsgc3Ryb2tlLW1pdGVybGltaXQ6IDEwOyBmaWxsOiByZ2IoMjU0LDI1NCwyNTQpOyBmaWxsLXJ1bGU6IGV2ZW5vZGQ7IG9wYWNpdHk6IDAuOTk5OyIgdmVjdG9yLWVmZmVjdD0ibm9uLXNjYWxpbmctc3Ryb2tlIiAgdHJhbnNmb3JtPSIgdHJhbnNsYXRlKC0zMjAuMDAzMjEsIC0xMjUuMTMzNjkpIiBkPSJNIDM0OC4yODU4IDg3LjQyMzU5IEMgMzYwLjU0MTkgOTQuMjg0IDM3Mi42OTMwNCAxMDEuMzAyNDggMzg0LjczODkxIDEwOC40Nzg0MDAwMDAwMDAwMSBDIDM3NS40MzU4Mjk5OTk5OTk5NSAxMTMuOTY5NjIgMzY2LjExMzI1OTk5OTk5OTk3IDExOS40NjkwMTAwMDAwMDAwMSAzNTYuNzcwNTggMTI0Ljk3NjU3MDAwMDAwMDAxIEMgMzY2LjM3MjIgMTMwLjY1MTk0IDM3Ni4wMDkzNCAxMzYuMjU2MjkgMzg1LjY4MTY1OTk5OTk5OTk3IDE0MS43ODg5OSBDIDM4NS4wODQyNjk5OTk5OTk5NSAxNDIuNTEwNTEgMzg0LjM1MTEyIDE0My4wODY1MyAzODMuNDgxODk5OTk5OTk5OTQgMTQzLjUxNzM3IEMgMzcyLjIwMjgwOTk5OTk5OTk0IDE1MC4wNDY1NiAzNjAuODg5NzY5OTk5OTk5OTQgMTU2LjQ4ODcxIDM0OS41NDI3OTk5OTk5OTk5NCAxNjIuODQzOCBDIDMzOS43MDE3MTk5OTk5OTk5NyAxNTcuMjk0NDM5OTk5OTk5OTggMzI5Ljg1NTI4OTk5OTk5OTk3IDE1MS43NDI1NyAzMjAuMDAzMjA5OTk5OTk5OTcgMTQ2LjE4ODQ5OTk5OTk5OTk4IEMgMzEwLjIxMzM1IDE1MS42NTkyODk5OTk5OTk5NyAzMDAuNDcxNTcgMTU3LjIxMTE2OTk5OTk5OTk4IDI5MC43Nzc4Njk5OTk5OTk5NSAxNjIuODQzOCBDIDI3OC40MTkwMDk5OTk5OTk5NiAxNTYuMTQyMDggMjY2LjI2Nzg2OTk5OTk5OTk2IDE0OS4xMjM1OTk5OTk5OTk5OCAyNTQuMzI0NzU5OTk5OTk5OTQgMTQxLjc4ODk4OTk5OTk5OTk4IEMgMjg1LjcwNzczOTk5OTk5OTk0IDEyMy43NDE4Njk5OTk5OTk5OCAzMTcuMDI3ODc5OTk5OTk5OSAxMDUuNjE5OTY5OTk5OTk5OTggMzQ4LjI4NTc4OTk5OTk5OTkgODcuNDIzNTc5OTk5OTk5OTkgeiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiAvPgo8L2c+CjxnIHRyYW5zZm9ybT0ibWF0cml4KDEuODQ3OTI4Njg3IDAgMCAxLjg0NzkyODY4NyAzNzcuNjAxMDg1NzU5NCAxNTUuMTI3NDA4MTA3NCkiIGlkPSI5STFiZF90d3RDZjlQcjFGRG9HVU4iICA+CjxwYXRoIHN0eWxlPSJzdHJva2U6IG5vbmU7IHN0cm9rZS13aWR0aDogMTsgc3Ryb2tlLWRhc2hhcnJheTogbm9uZTsgc3Ryb2tlLWxpbmVjYXA6IGJ1dHQ7IHN0cm9rZS1kYXNob2Zmc2V0OiAwOyBzdHJva2UtbGluZWpvaW46IG1pdGVyOyBzdHJva2UtbWl0ZXJsaW1pdDogMTA7IGZpbGw6IHJnYigyMjQsMTA0LDc2KTsgZmlsbC1ydWxlOiBldmVub2RkOyBvcGFjaXR5OiAxOyIgdmVjdG9yLWVmZmVjdD0ibm9uLXNjYWxpbmctc3Ryb2tlIiAgdHJhbnNmb3JtPSIgdHJhbnNsYXRlKC0zODUuNTI0NTM1LCAtMTI1LjEzMzcpIiBkPSJNIDM4NC43Mzg5MSAxMDguNDc4NCBDIDM5NC4wOTEzMjk5OTk5OTk5NyAxMTMuNjg4MDQ5OTk5OTk5OTkgNDAzLjQxNDIwOTk5OTk5OTk3IDExOC45Nzc4Mzk5OTk5OTk5OSA0MTIuNzA3MjM5OTk5OTk5OTYgMTI0LjM0ODA2OTk5OTk5OTk5IEMgNDEzLjM5NjA4IDEyNC42ODMzOCA0MTMuOTE5NjE5OTk5OTk5OTUgMTI1LjE1NDc0OTk5OTk5OTk5IDQxNC4yNzg0OSAxMjUuNzYyMTk5OTk5OTk5OTkgQyA0MDQuNzU3NjI5OTk5OTk5OTUgMTMwLjk0MTY4IDM5NS4zMzAwOTk5OTk5OTk5NiAxMzYuMjgzOTUgMzg1Ljk5NTkxIDE0MS43ODkgQyAzODUuODkxMjYgMTQxLjc4OSAzODUuNzg2MyAxNDEuNzg5IDM4NS42ODE2NTk5OTk5OTk5NyAxNDEuNzg5IEMgMzc2LjAwOTMzIDEzNi4yNTYyOTk5OTk5OTk5OCAzNjYuMzcyMTk5OTk5OTk5OTYgMTMwLjY1MTk1IDM1Ni43NzA1OCAxMjQuOTc2NTc5OTk5OTk5OTggQyAzNjYuMTEzMjU5OTk5OTk5OTcgMTE5LjQ2OTAxOTk5OTk5OTk5IDM3NS40MzU4MyAxMTMuOTY5NjI5OTk5OTk5OTggMzg0LjczODkxIDEwOC40Nzg0MDk5OTk5OTk5OCB6IiBzdHJva2UtbGluZWNhcD0icm91bmQiIC8+CjwvZz4KPGcgdHJhbnNmb3JtPSJtYXRyaXgoMS44NDc5Mjg2ODcgMCAwIDEuODQ3OTI4Njg3IDI1Ni41MTY0NDI3MjM5IDMwNi42OTM1NzY1NzM5KSIgaWQ9IkZpc3hnM241dXFzM3pUVVhNcm9ybiIgID4KPHBhdGggc3R5bGU9InN0cm9rZTogbm9uZTsgc3Ryb2tlLXdpZHRoOiAxOyBzdHJva2UtZGFzaGFycmF5OiBub25lOyBzdHJva2UtbGluZWNhcDogYnV0dDsgc3Ryb2tlLWRhc2hvZmZzZXQ6IDA7IHN0cm9rZS1saW5lam9pbjogbWl0ZXI7IHN0cm9rZS1taXRlcmxpbWl0OiAxMDsgZmlsbDogcmdiKDE4Nyw3MCw3NSk7IGZpbGwtcnVsZTogZXZlbm9kZDsgb3BhY2l0eTogMTsiIHZlY3Rvci1lZmZlY3Q9Im5vbi1zY2FsaW5nLXN0cm9rZSIgIHRyYW5zZm9ybT0iIHRyYW5zbGF0ZSgtMzIwLjAwMDAxMzQ3MiwgLTIwNy4xNTMxOSkiIGQ9Ik0gMjI2LjA0MjE5IDEyNS40NDc5NSBDIDIzNS4yMjE3NyAxMzEuMTI4MDQgMjQ0LjU0NDY2IDEzNi41NzQ5NSAyNTQuMDEwNTIgMTQxLjc4OTAwMDAwMDAwMDAyIEMgMjUzLjkwNTg3MDAwMDAwMDAyIDE2Ny4yNDQyNzAwMDAwMDAwMyAyNTQuMDEwNTIgMTkyLjY5ODU5MDAwMDAwMDAyIDI1NC4zMjQ3NyAyMTguMTUxOTcgQyAyNzYuMTY0MjcgMjMwLjY5NDk4MDAwMDAwMDAyIDI5Ny45NTIyMyAyNDMuMzE3NSAzMTkuNjg4OTYgMjU2LjAxOTIxIEMgMzE5Ljk4MzQxIDI1Ni4yMzY2NyAzMjAuMTkyNyAyNTYuMTg0MTkgMzIwLjMxNzQ2IDI1NS44NjIwOCBDIDM0Mi4xODc3NSAyNDMuMzcyMTggMzY0LjAyODE5IDIzMC44MDIxMzk5OTk5OTk5OCAzODUuODM4NzggMjE4LjE1MTk3IEMgMzg1Ljk5NTkxIDE5Mi42OTc5NiAzODYuMDQ4MzkgMTY3LjI0MzYzIDM4NS45OTU5MSAxNDEuNzg5IEMgMzk1LjMzMDExIDEzNi4yODM5NDk5OTk5OTk5OCA0MDQuNzU3NjMgMTMwLjk0MTY5IDQxNC4yNzg0OSAxMjUuNzYyMTk5OTk5OTk5OTggQyA0MTQuMjc4NDkgMTYyLjAwNTcgNDE0LjI3ODQ5IDE5OC4yNDk1MTk5OTk5OTk5NiA0MTQuMjc4NDkgMjM0LjQ5MzAxOTk5OTk5OTk3IEMgNDEzLjc5ODYzIDIzNC40NzAwNzk5OTk5OTk5NyA0MTMuNDg0MzggMjM0LjY3OTY4OTk5OTk5OTk3IDQxMy4zMzU3NCAyMzUuMTIxNTE5OTk5OTk5OTggQyAzODIuMzg2NzQgMjUzLjI2ODU2OTk5OTk5OTk4IDM1MS4yNzU5IDI3MS4xODA4Njk5OTk5OTk5NyAzMjAuMDAzMjIgMjg4Ljg1ODQzIEMgMzE5LjcxNTM3IDI4OC44NDQ5MiAzMTkuNTA1NzYgMjg4Ljc0MDI3IDMxOS4zNzQ3MiAyODguNTQ0MTggQyAzMTkuMjI2MDggMjg4LjEwMjMzOTk5OTk5OTk3IDMxOC45MTE4MyAyODcuODkyNzQgMzE4LjQzMTk3MDAwMDAwMDA0IDI4Ny45MTU2OCBDIDMxNS45NDA1OTAwMDAwMDAwNCAyODYuNjc3MjIwMDAwMDAwMDMgMzEzLjUzMTIzMDAwMDAwMDA1IDI4NS4zMTU1NzAwMDAwMDAwNCAzMTEuMjA0MiAyODMuODMwNDIgQyAzMTEuMDU1NTYgMjgzLjM4ODU4IDMxMC43NDEzMSAyODMuMTc4OTggMzEwLjI2MTQ1IDI4My4yMDE5MjAwMDAwMDAwMyBDIDMwOC40ODEyMiAyODIuNDE3MjQwMDAwMDAwMDUgMzA2LjgwNTMyMDAwMDAwMDA1IDI4MS40NzQ0OCAzMDUuMjMzNDQwMDAwMDAwMDMgMjgwLjM3MzY2MDAwMDAwMDAzIEMgMzA1LjA4NDgwMDAwMDAwMDAzIDI3OS45MzE4MiAzMDQuNzcwNTUgMjc5LjcyMjIyMDAwMDAwMDA1IDMwNC4yOTA2OTAwMDAwMDAwNCAyNzkuNzQ1MTYwMDAwMDAwMDYgQyAzMDMuMjY2MjMwMDAwMDAwMDYgMjc5LjM0NDgwMDAwMDAwMDEgMzAyLjMyMzQ4IDI3OC44MjEyNjAwMDAwMDAwNSAzMDEuNDYyNDMwMDAwMDAwMDQgMjc4LjE3MzkxMDAwMDAwMDAzIEMgMzAxLjMxMzc5MDAwMDAwMDA0IDI3Ny43MzIwNyAzMDAuOTk5NTQgMjc3LjUyMjQ3MDAwMDAwMDA2IDMwMC41MTk2ODAwMDAwMDAwNSAyNzcuNTQ1NDEwMDAwMDAwMDYgQyAyOTkuMjEzOTcwMDAwMDAwMSAyNzcuMTU1MTEwMDAwMDAwMDQgMjk4LjA2MTYxMDAwMDAwMDAzIDI3Ni41MjY2MTAwMDAwMDAwNiAyOTcuMDYyOTIwMDAwMDAwMSAyNzUuNjU5OTAwMDAwMDAwMDUgQyAyOTYuOTE0MjgwMDAwMDAwMSAyNzUuMjE4MDYwMDAwMDAwMDQgMjk2LjYwMDAzMDAwMDAwMDA2IDI3NS4wMDg0NjAwMDAwMDAwNyAyOTYuMTIwMTcwMDAwMDAwMSAyNzUuMDMxNDAwMDAwMDAwMSBDIDI5NC4zMzk5NDAwMDAwMDAwNyAyNzQuMjQ2NzIwMDAwMDAwMSAyOTIuNjY0MDQwMDAwMDAwMSAyNzMuMzAzOTYwMDAwMDAwMSAyOTEuMDkyMTYwMDAwMDAwMSAyNzIuMjAzMTQwMDAwMDAwMSBDIDI5MC45NDM1MjAwMDAwMDAxIDI3MS43NjEzMDAwMDAwMDAwNiAyOTAuNjI5MjcwMDAwMDAwMSAyNzEuNTUxNzAwMDAwMDAwMSAyOTAuMTQ5NDEwMDAwMDAwMSAyNzEuNTc0NjQwMDAwMDAwMSBDIDI4Ny42NTgwMzAwMDAwMDAxIDI3MC4zMzYxODAwMDAwMDAxIDI4NS4yNDg2NzAwMDAwMDAxIDI2OC45NzQ1MzAwMDAwMDAxMyAyODIuOTIxNjQwMDAwMDAwMSAyNjcuNDg5MzgwMDAwMDAwMSBDIDI4Mi43NzMwMDAwMDAwMDAxIDI2Ny4wNDc1NDAwMDAwMDAxIDI4Mi40NTg3NTAwMDAwMDAwNyAyNjYuODM3OTQwMDAwMDAwMSAyODEuOTc4ODkwMDAwMDAwMSAyNjYuODYwODgwMDAwMDAwMSBDIDI3Ny40NzQ0MjAwMDAwMDAwNyAyNjQuNTA0NjMwMDAwMDAwMTMgMjczLjA3NDkwMDAwMDAwMDA3IDI2MS45OTA2MjAwMDAwMDAxNSAyNjguNzgwMzUwMDAwMDAwMSAyNTkuMzE4ODYwMDAwMDAwMTQgQyAyNjguNjMxNzEwMDAwMDAwMSAyNTguODc3MDIwMDAwMDAwMTMgMjY4LjMxNzQ2MDAwMDAwMDEgMjU4LjY2NzQyMDAwMDAwMDE2IDI2Ny44Mzc2MDAwMDAwMDAxIDI1OC42OTAzNjAwMDAwMDAxNyBDIDI1My43NDIxOTAwMDAwMDAxNCAyNTAuODMwMzIwMDAwMDAwMTcgMjM5Ljc1ODAyMDAwMDAwMDEzIDI0Mi43NjQ3NTAwMDAwMDAxNiAyMjUuODg1MTAwMDAwMDAwMTQgMjM0LjQ5MzA0MDAwMDAwMDE4IEMgMjI1LjYyMzMzMDAwMDAwMDEyIDE5OC4wOTIxMDAwMDAwMDAyIDIyNS42NzU4MTAwMDAwMDAxMyAxNjEuNzQzNjQwMDAwMDAwMiAyMjYuMDQyMjMwMDAwMDAwMTMgMTI1LjQ0Nzk3MDAwMDAwMDE4IHoiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgLz4KPC9nPgo8ZyB0cmFuc2Zvcm09Im1hdHJpeCgxLjg0NzkyODY4NyAwIDAgMS44NDc5Mjg2ODcgMTk1LjgwMTU5NDQ0NDcgMjkxLjU3MTI3MTQ5NzgpIiBpZD0iMFdhMXByWHI5WThMVmIzZ3BCcThTIiAgPgo8cGF0aCBzdHlsZT0ic3Ryb2tlOiBub25lOyBzdHJva2Utd2lkdGg6IDE7IHN0cm9rZS1kYXNoYXJyYXk6IG5vbmU7IHN0cm9rZS1saW5lY2FwOiBidXR0OyBzdHJva2UtZGFzaG9mZnNldDogMDsgc3Ryb2tlLWxpbmVqb2luOiBtaXRlcjsgc3Ryb2tlLW1pdGVybGltaXQ6IDEwOyBmaWxsOiByZ2IoMjEzLDIwOSwyMDEpOyBmaWxsLXJ1bGU6IGV2ZW5vZGQ7IG9wYWNpdHk6IDE7IiB2ZWN0b3ItZWZmZWN0PSJub24tc2NhbGluZy1zdHJva2UiICB0cmFuc2Zvcm09IiB0cmFuc2xhdGUoLTI4Ny4xNDQzOTA0NjgxLCAtMTk4Ljk2OTgwODY5MTkpIiBkPSJNIDI1NC4wMTA1MyAxNDEuNzg5IEMgMjU0LjExNTE3OTk5OTk5OTk4IDE0MS43ODkgMjU0LjIyMDE0IDE0MS43ODkgMjU0LjMyNDc3OTk5OTk5OTk4IDE0MS43ODkgQyAyNjYuMjY3ODg5OTk5OTk5OTcgMTQ5LjEyMzYyIDI3OC40MTkwMjk5OTk5OTk5NiAxNTYuMTQyMSAyOTAuNzc3ODg5OTk5OTk5OTYgMTYyLjg0MzgxIEMgMjkwLjc3Nzg4OTk5OTk5OTk2IDE3NC4xNTY4NCAyOTAuNzc3ODg5OTk5OTk5OTYgMTg1LjQ2OTg4IDI5MC43Nzc4ODk5OTk5OTk5NiAxOTYuNzgyOTEgQyAyOTkuMjk1NjU5OTk5OTk5OTQgMjAxLjkzNDEwOTk5OTk5OTk4IDMwNy44ODUzOTk5OTk5OTk5NSAyMDcuMDE0NjA5OTk5OTk5OTggMzE2LjU0NjQ2OTk5OTk5OTk0IDIxMi4wMjQwOCBDIDMxNy43ODQ5Mjk5OTk5OTk5IDIxMi42OTg0NiAzMTkuMDQxOTM5OTk5OTk5OTUgMjEzLjI3NDQ4IDMyMC4zMTc0Nzk5OTk5OTk5MyAyMTMuNzUyNDU5OTk5OTk5OTkgQyAzMTkuODk5NTI5OTk5OTk5OSAyMjcuODE5NTg5OTk5OTk5OTggMzE5Ljg5OTUyOTk5OTk5OTkgMjQxLjg1NjIyOTk5OTk5OTk4IDMyMC4zMTc0Nzk5OTk5OTk5MyAyNTUuODYyMDggQyAzMjAuMTkyNzE5OTk5OTk5OTUgMjU2LjE4NDE5IDMxOS45ODM0Mjk5OTk5OTk5NCAyNTYuMjM2NjcgMzE5LjY4ODk3OTk5OTk5OTk2IDI1Ni4wMTkyMSBDIDI5Ny45NTIyMzk5OTk5OTk5NiAyNDMuMzE3NSAyNzYuMTY0Mjc5OTk5OTk5OTYgMjMwLjY5NDk5IDI1NC4zMjQ3ODk5OTk5OTk5NSAyMTguMTUxOTY5OTk5OTk5OTggQyAyNTQuMDEwNTM5OTk5OTk5OTYgMTkyLjY5ODU4OTk5OTk5OTk3IDI1My45MDU4ODk5OTk5OTk5NCAxNjcuMjQ0MjU5OTk5OTk5OTcgMjU0LjAxMDUzOTk5OTk5OTk2IDE0MS43ODkgeiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiAvPgo8L2c+CjxnIHRyYW5zZm9ybT0ibWF0cml4KDEuODQ3OTI4Njg3IDAgMCAxLjg0NzkyODY4NyAzMTcuNTE2MTY3MTMgMjkxLjMwNDY3MzI0MzQpIiBpZD0iR3pCRzlsclJqOVhnM0kwYzhQSERyIiAgPgo8cGF0aCBzdHlsZT0ic3Ryb2tlOiBub25lOyBzdHJva2Utd2lkdGg6IDE7IHN0cm9rZS1kYXNoYXJyYXk6IG5vbmU7IHN0cm9rZS1saW5lY2FwOiBidXR0OyBzdHJva2UtZGFzaG9mZnNldDogMDsgc3Ryb2tlLWxpbmVqb2luOiBtaXRlcjsgc3Ryb2tlLW1pdGVybGltaXQ6IDEwOyBmaWxsOiByZ2IoMjI0LDIyMSwyMTUpOyBmaWxsLXJ1bGU6IGV2ZW5vZGQ7IG9wYWNpdHk6IDE7IiB2ZWN0b3ItZWZmZWN0PSJub24tc2NhbGluZy1zdHJva2UiICB0cmFuc2Zvcm09IiB0cmFuc2xhdGUoLTM1My4wMDk3OTYxNzMyLCAtMTk4LjgyNTU0KSIgZD0iTSAzODUuNjgxNjYgMTQxLjc4OSBDIDM4NS43ODYzMSAxNDEuNzg5IDM4NS44OTEyNyAxNDEuNzg5IDM4NS45OTU5MTAwMDAwMDAwNCAxNDEuNzg5IEMgMzg2LjA0ODM5MDAwMDAwMDA0IDE2Ny4yNDM2NCAzODUuOTk1OTEwMDAwMDAwMDQgMTkyLjY5Nzk2IDM4NS44Mzg3ODAwMDAwMDAwNCAyMTguMTUxOTcgQyAzNjQuMDI4MTkwMDAwMDAwMDUgMjMwLjgwMjE0IDM0Mi4xODc3NiAyNDMuMzcyMTgwMDAwMDAwMDEgMzIwLjMxNzQ2MDAwMDAwMDA0IDI1NS44NjIwOCBDIDMxOS44OTk1MSAyNDEuODU2MjI5OTk5OTk5OTggMzE5Ljg5OTUxIDIyNy44MTk1OCAzMjAuMzE3NDYwMDAwMDAwMDQgMjEzLjc1MjQ1OTk5OTk5OTk5IEMgMzI5Ljk1NDU5MDAwMDAwMDA1IDIwOC4yMDA1ODk5OTk5OTk5OCAzMzkuNTkxNDEwMDAwMDAwMDUgMjAyLjY0OTAyOTk5OTk5OTk4IDM0OS4yMjg1NDAwMDAwMDAwNyAxOTcuMDk3MTU5OTk5OTk5OTcgQyAzNDkuNTQyMTYwMDAwMDAwMSAxODUuNzMyODk5OTk5OTk5OTcgMzQ5LjY0NzEyMDAwMDAwMDEgMTc0LjMxNTIyOTk5OTk5OTk5IDM0OS41NDI3OTAwMDAwMDAxIDE2Mi44NDM4MDk5OTk5OTk5NiBDIDM2MC44ODk3NjAwMDAwMDAxIDE1Ni40ODg3MDk5OTk5OTk5NyAzNzIuMjAyODAwMDAwMDAwMSAxNTAuMDQ2NTY5OTk5OTk5OTcgMzgzLjQ4MTg5MDAwMDAwMDEgMTQzLjUxNzM3OTk5OTk5OTk3IEMgMzg0LjM1MTExMDAwMDAwMDA2IDE0My4wODY1Mzk5OTk5OTk5OSAzODUuMDg0MjYwMDAwMDAwMSAxNDIuNTEwNTE5OTk5OTk5OTkgMzg1LjY4MTY1MDAwMDAwMDEgMTQxLjc4OSB6IiBzdHJva2UtbGluZWNhcD0icm91bmQiIC8+CjwvZz4KPGcgdHJhbnNmb3JtPSJtYXRyaXgoMS44NDc5Mjg2ODcgMCAwIDEuODQ3OTI4Njg3IDI1Ni44NDg3ODIzNDcyIDI0MS4wNzI5NzI4ODI4KSIgaWQ9IlZjRmdYalpnNjNNekJUUXBfU3RKUCIgID4KPHBhdGggc3R5bGU9InN0cm9rZTogbm9uZTsgc3Ryb2tlLXdpZHRoOiAxOyBzdHJva2UtZGFzaGFycmF5OiBub25lOyBzdHJva2UtbGluZWNhcDogYnV0dDsgc3Ryb2tlLWRhc2hvZmZzZXQ6IDA7IHN0cm9rZS1saW5lam9pbjogbWl0ZXI7IHN0cm9rZS1taXRlcmxpbWl0OiAxMDsgZmlsbDogcmdiKDE4Nyw3MCw3NSk7IGZpbGwtcnVsZTogZXZlbm9kZDsgb3BhY2l0eTogMTsiIHZlY3Rvci1lZmZlY3Q9Im5vbi1zY2FsaW5nLXN0cm9rZSIgIHRyYW5zZm9ybT0iIHRyYW5zbGF0ZSgtMzIwLjE3OTg1Nzg3MDYsIC0xNzEuNjQyODM1KSIgZD0iTSAzNDkuNTQyODEgMTYyLjg0MzgxIEMgMzQ5LjY0NzE0IDE3NC4zMTUyMjk5OTk5OTk5OSAzNDkuNTQyMTggMTg1LjczMjkgMzQ5LjIyODU1OTk5OTk5OTk2IDE5Ny4wOTcxNTk5OTk5OTk5NyBDIDMzOS41MjYwNiAxOTEuMzI3ODI5OTk5OTk5OTggMzI5LjczMjExOTk5OTk5OTk1IDE4NS42NzEzMDk5OTk5OTk5OCAzMTkuODQ2MSAxODAuMTI3NjA5OTk5OTk5OTggQyAzMTAuMTMyMjg5OTk5OTk5OTUgMTg1LjY1MTIgMzAwLjQ0Mjk4OTk5OTk5OTk1IDE5MS4yMDI3NTk5OTk5OTk5OCAyOTAuNzc3ODg5OTk5OTk5OTYgMTk2Ljc4MjkxIEMgMjkwLjc3Nzg4OTk5OTk5OTk2IDE4NS40Njk4OCAyOTAuNzc3ODg5OTk5OTk5OTYgMTc0LjE1Njg0IDI5MC43Nzc4ODk5OTk5OTk5NiAxNjIuODQzODEgQyAzMDAuNDcxNTg5OTk5OTk5OTQgMTU3LjIxMTE3OTk5OTk5OTk4IDMxMC4yMTMzNjk5OTk5OTk5NCAxNTEuNjU5MzEgMzIwLjAwMzIzIDE0Ni4xODg1MDk5OTk5OTk5OCBDIDMyOS44NTUzMSAxNTEuNzQyNTc5OTk5OTk5OTggMzM5LjcwMTczIDE1Ny4yOTQ0NDk5OTk5OTk5OCAzNDkuNTQyODE5OTk5OTk5OTUgMTYyLjg0MzgxIHoiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgLz4KPC9nPgo8ZyB0cmFuc2Zvcm09Im1hdHJpeCgxLjg0NzkyODY4NyAwIDAgMS44NDc5Mjg2ODcgMjU2LjUyMjM3NzM5ODYgMjg3LjgyMDM5NDQ2NDQpIiBpZD0iSlZqX254cHRaQjQ4UDhpZTV0d0RyIiAgPgo8cGF0aCBzdHlsZT0ic3Ryb2tlOiBub25lOyBzdHJva2Utd2lkdGg6IDE7IHN0cm9rZS1kYXNoYXJyYXk6IG5vbmU7IHN0cm9rZS1saW5lY2FwOiBidXR0OyBzdHJva2UtZGFzaG9mZnNldDogMDsgc3Ryb2tlLWxpbmVqb2luOiBtaXRlcjsgc3Ryb2tlLW1pdGVybGltaXQ6IDEwOyBmaWxsOiByZ2IoMjIzLDEwNCw3NSk7IGZpbGwtcnVsZTogZXZlbm9kZDsgb3BhY2l0eTogMTsiIHZlY3Rvci1lZmZlY3Q9Im5vbi1zY2FsaW5nLXN0cm9rZSIgIHRyYW5zZm9ybT0iIHRyYW5zbGF0ZSgtMzIwLjAwMzIyNSwgLTE5Ni45NDAwMzUpIiBkPSJNIDM0OS4yMjg1NiAxOTcuMDk3MTYgQyAzMzkuNTkxNDMgMjAyLjY0OTAzIDMyOS45NTQ2MSAyMDguMjAwNTkgMzIwLjMxNzQ4MDAwMDAwMDA1IDIxMy43NTI0NiBDIDMxOS4wNDE5NDAwMDAwMDAwNyAyMTMuMjc0NDggMzE3Ljc4NDkzMDAwMDAwMDAzIDIxMi42OTg0NiAzMTYuNTQ2NDcwMDAwMDAwMDYgMjEyLjAyNDA4MDAwMDAwMDAzIEMgMzA3Ljg4NTQwMDAwMDAwMDA2IDIwNy4wMTQ2MTAwMDAwMDAwMyAyOTkuMjk1NjcwMDAwMDAwMDMgMjAxLjkzNDExMDAwMDAwMDAzIDI5MC43Nzc4OTAwMDAwMDAwNyAxOTYuNzgyOTEwMDAwMDAwMDIgQyAzMDAuNDQyOTkwMDAwMDAwMDcgMTkxLjIwMjc2IDMxMC4xMzIyOTAwMDAwMDAwNyAxODUuNjUxMjAwMDAwMDAwMDIgMzE5Ljg0NjEwMDAwMDAwMDEgMTgwLjEyNzYxIEMgMzI5LjczMjEyMDAwMDAwMDA3IDE4NS42NzEzMSAzMzkuNTI2MDYwMDAwMDAwMSAxOTEuMzI3ODMgMzQ5LjIyODU2MDAwMDAwMDEgMTk3LjA5NzE2IHoiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgLz4KPC9nPgo8L3N2Zz4";
class BabylonTW {
  getInfo() {
    return {
      id: 'BabylonTW',
      name: 'BabylonJS',
			blockIconURI: blocksIcon,
			color1: '#e0684b',
      color2: '#cd554b',
      color3: '#bb464b',
      blocks: [
				{
					opcode: 'hasBabylon',
					blockType: Scratch.BlockType.BOOLEAN,
					text: 'project has BabylonJS?'
				},
				{
					opcode: 'addBabylon',
					blockType: Scratch.BlockType.COMMAND,
					text: 'add BabylonJS to project'
				},
				'---',
				{
					opcode: 'simpleScene',
					blocktype: Scratch.BlockType.COMMAND,
					text: 'simple BabylonJS scene'
				},
				'---',
				{
					opcode: 'newBox',
					blockype: Scratch.BlockType.COMMAND,
					text: 'create new box with size width:[X] height:[Y] depth:[Z] called [NAME]',
					arguments: {
						X: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 1
						},
						Y: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 1
						},
						Z: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 1
						},
						NAME: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 'box'
						}
					}
				},
				{
					opcode: 'newSphere',
					blockype: Scratch.BlockType.COMMAND,
					text: 'create new sphere with size diameterX:[X] diameterY:[Y] diameterZ:[Z] segments:[SEGMENTS] called [NAME]',
					arguments: {
						X: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 1
						},
						Y: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 1
						},
						Z: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 1
						},
						SEGMENTS: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 12
						},
						NAME: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 'sphere'
						}
					}
				},
				'---',
				{
					opcode: 'moveObjectTo',
					blockype: Scratch.BlockType.COMMAND,
					text: 'set object position to x:[X] y:[Y] z:[Z] called [NAME]',
					arguments: {
						X: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 1
						},
						Y: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 1
						},
						Z: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 1
						},
						NAME: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 'name'
						}
					}
				},
				{
					opcode: 'moveObjectBy',
					blockype: Scratch.BlockType.COMMAND,
					text: 'change object position by x:[X] y:[Y] z:[Z] [SPACE] called [NAME]',
					arguments: {
						X: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 1
						},
						Y: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 1
						},
						Z: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 1
						},
						NAME: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 'name'
						},
						SPACE: {
							type: Scratch.ArgumentType.STRING,
							menu: 'SPACE_MENU'
						}
					}
				},
				{
					opcode: 'rotateObjectTo',
					blockype: Scratch.BlockType.COMMAND,
					text: 'set object rotation to x:[X] y:[Y] z:[Z] called [NAME]',
					arguments: {
						X: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 1
						},
						Y: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 1
						},
						Z: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 1
						},
						NAME: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 'name'
						}
					}
				},
				{
					opcode: 'rotateObjectBy',
					blockype: Scratch.BlockType.COMMAND,
					text: 'change object rotate by x:[X] y:[Y] z:[Z] [SPACE] called [NAME]',
					arguments: {
						X: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 1
						},
						Y: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 1
						},
						Z: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 1
						},
						NAME: {
							type: Scratch.ArgumentType.STRING,
							defaultValue: 'name'
						},
						SPACE: {
							type: Scratch.ArgumentType.STRING,
							menu: 'SPACE_MENU'
						}
					}
				}
      ],
			menus: {
        SPACE_MENU: {
          acceptReporters: true,
          items: ['local', 'world']
        }
      }
    };
  }

	addBabylon() {
    var script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = 'https://cdn.babylonjs.com/babylon.js';
		script.id = 'babylonScript';
    document.head.appendChild(script);
	}
	hasBabylon() {
		if (document.getElementById('babylonScript')) {
			return true
		} else {
			return false
		}
	}
	simpleScene() {
		const engine = new BABYLON.Engine(canvas, true); // Generate the BABYLON 3D engine
const createScene = function() {
	// Creates a basic Babylon Scene object
	const scene = new BABYLON.Scene(engine);
	var babylonScene = scene;
	objects[0] = scene;
	// Creates and positions a free camera
	const camera = new BABYLON.FreeCamera("camera1",
		new BABYLON.Vector3(0, 5, -10), scene);
	objects.push(camera);
	// Targets the camera to scene origin
	camera.setTarget(BABYLON.Vector3.Zero());
	// This attaches the camera to the canvas
	camera.attachControl(canvas, true);
	// Creates a light, aiming 0,1,0 - to the sky
	var light = new BABYLON.DirectionalLight("dir01", new BABYLON.Vector3(-1, -2, 1), scene);
	light.position = new BABYLON.Vector3(20, 40, -20);
	var shadowGenerator = new BABYLON.ShadowGenerator(1024, light);
  shadowGenerator.useBlurCloseExponentialShadowMap = true;
  shadowGenerator.forceBackFacesOnly = true;
  shadowGenerator.blurKernel = 32;
  shadowGenerator.useKernelBlur = true;
  light.shadowMinZ = 10;
  light.shadowMaxZ = 70;
	// Built-in 'sphere' shape.
	const sphere = BABYLON.MeshBuilder.CreateSphere("sphere",
		{ diameter: 2, segments: 32 }, scene);
	objects.push(sphere);
	shadowGenerator.getShadowMap().renderList.push(sphere);
	
  sphere.receiveShadows = true;
	// Move the sphere upward 1/2 its height
	sphere.position.y = 1;
	// Built-in 'ground' shape.
	const ground = BABYLON.MeshBuilder.CreateGround("ground",
		{ width: 6, height: 6 }, scene);
	shadowGenerator.getShadowMap().renderList.push(ground);
	ground.recieveShadows = true;
	return scene;
};
const scene = createScene(); //Call the createScene function
// Register a render loop to repeatedly render the scene
engine.runRenderLoop(function() {
	scene.render();
});
// Watch for browser/canvas resize events
window.addEventListener("resize", function() {
	engine.resize();
});
	}
	newBox(args) {
		new BABYLON.MeshBuilder.CreateBox(args.NAME, {width: args.X, height: args.Y, depth: args.Z});
	}
	newSphere(args) {
		new BABYLON.MeshBuilder.CreateSphere(args.NAME, {diameterX: args.X, diameterY: args.Y, diameterZ: args.Z, segments: args.SEGMENTS});
	}
	moveObjectTo(args) {
		var mesh = objects[0].getMeshByName(args.NAME);
		mesh.position = new BABYLON.Vector3(args.X, args.Y, args.Z);
	}
	moveObjectBy(args) {
		var mesh = objects[0].getMeshByName(args.NAME);
		if(args.SPACE == 'local') {
			var space = BABYLON.Space.LOCAL;
		} else if (args.SPACE == 'world') {
			var space = BABYLON.Space.WORLD;
		};
		mesh.translate(new BABYLON.Vector3(args.X, args.Y, args.Z), BABYLON.Space.WORLD);
	}
	rotateObjectTo(args) {
		var mesh = objects[0].getMeshByName(args.NAME);
		mesh.rotation = new BABYLON.Vector3(args.X, args.Y, args.Z);
	}
	rotateObjectBy(args) {
		var mesh = objects[0].getMeshByName(args.NAME);
		if(args.SPACE == 'local') {
			var space = BABYLON.Space.LOCAL;
		} else if (args.SPACE == 'world') {
			var space = BABYLON.Space.WORLD;
		};
		mesh.rotate(new BABYLON.Vector3(args.X, args.Y, args.Z), BABYLON.Space.WORLD);
	}
}

Scratch.extensions.register(new BabylonTW());
